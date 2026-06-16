"""
PipelineService — multi-task inference orchestration.

Ported from the standalone pipeline-service (app/services/pipeline_service.py).
The pipeline executes a sequence of AI tasks (e.g. Speech-to-Speech:
ASR → Translation → TTS), feeding each task's output into the next.

Key architectural change vs the original service
-------------------------------------------------
The original pipeline-service was a *separate* microservice that reached the
ASR / NMT / TTS services over HTTP (httpx + service-registry discovery,
JWT/API-key propagation, W3C trace-context injection).

In this monolith the ASR / NMT / TTS task services live in-process, so the
pipeline drives them directly through the shared ``Orchestrator`` instead of
making network hops. That removes the entire HTTP client, service-discovery,
and downstream-auth-propagation layer:

* No ``ServiceClient`` / ``ServiceRegistryHttpClient`` — ``Orchestrator.route_task``
  resolves the model (via the cached ``InferenceServerResolver``) and runs the
  TaskService locally.
* No manual JWT / API-key / X-User-Id header forwarding — auth and tenant
  context already live in this request's contextvars (seeded by
  ``RequestMiddleware``) and are read by the trace/resolver layers.
* No ``StandardSpanManager`` phase spans and no W3C inject — tracing uses this
  service's ``traced_span`` helpers; each step's ``model`` / ``ai-inference``
  spans nest naturally under the route's root request span.
* No bespoke JSON-string error parsing — task services raise typed exceptions
  (ValueError/LookupError/RuntimeError/…) that the route maps to HTTP status
  codes via ``routes.inference._http_error_for``.
"""

import logging
from typing import Any, Dict, List, Optional

from models.pipeline import (
    PipelineInferenceRequest,
    PipelineInferenceResponse,
    PipelineTask,
    PipelineTaskOutput,
    TaskType,
)
from orchestrator import Orchestrator
from trace.request_span import get_context_attributes, traced_span

logger = logging.getLogger(__name__)


# Pipeline (outer) task type → internal Orchestrator task_type. Only the
# difference worth mapping is TRANSLATION → NMT; the rest are 1:1 uppercase.
_INTERNAL_TASK_TYPE: Dict[TaskType, str] = {
    TaskType.ASR: "ASR",
    TaskType.TRANSLATION: "NMT",
    TaskType.TTS: "TTS",
    TaskType.TRANSLITERATION: "TRANSLITERATION",
}


class PipelineService:
    """Execute a multi-task AI pipeline by composing in-process TaskServices."""

    def __init__(self, orchestrator: Orchestrator):
        self.orchestrator = orchestrator

    async def run_pipeline_inference(
        self, request: PipelineInferenceRequest
    ) -> PipelineInferenceResponse:
        """
        Execute the pipeline tasks in sequence and return every task's output.

        Each task is routed through ``Orchestrator.route_task`` (no per-task
        root span), so the model/ai-inference spans nest under the route's
        request span. The output of task N is transformed into the input of
        task N+1.
        """
        results: List[PipelineTaskOutput] = []
        previous_output: Dict[str, Any] = dict(request.inputData)
        total = len(request.pipelineTasks)

        logger.info("Starting pipeline with %s task(s)", total)

        for task_index, task in enumerate(request.pipelineTasks, start=1):
            with traced_span("pipeline-task") as attrs:
                attrs["task.index"] = task_index
                attrs["task.type"] = task.taskType.value
                attrs["task.service_id"] = task.config.serviceId
                attrs.update(get_context_attributes())

                logger.info(
                    "Executing task %s/%s: %s (serviceId=%s)",
                    task_index, total, task.taskType.value, task.config.serviceId,
                )

                task_output = await self._execute_task(task, previous_output)
                attrs["task.output_count"] = (
                    len(task_output.output) if task_output.output else 0
                )

            results.append(task_output)
            previous_output = self._transform_output_for_next_task(
                task.taskType, task_output
            )
            logger.info("Task %s completed", task_index)

        logger.info("Pipeline completed with %s result(s)", len(results))
        return PipelineInferenceResponse(pipelineResponse=results)

    async def _execute_task(
        self, task: PipelineTask, input_data: Dict[str, Any]
    ) -> PipelineTaskOutput:
        """Build the per-task payload, route it in-process, and shape the output."""
        payload = self._build_task_payload(task, input_data)
        result = await self.orchestrator.route_task(payload)

        if task.taskType in (TaskType.ASR, TaskType.TRANSLATION, TaskType.TRANSLITERATION):
            return PipelineTaskOutput(
                taskType=task.taskType.value,
                serviceId=task.config.serviceId,
                output=result.get("output", []),
                config=result.get("config"),
            )

        # TTS: audio is the payload; mirror it under both output and audio to
        # preserve the original pipeline-service response contract.
        audio = result.get("audio", [])
        return PipelineTaskOutput(
            taskType=task.taskType.value,
            serviceId=task.config.serviceId,
            output=audio,
            audio=audio,
            config=result.get("config"),
        )

    def _build_task_payload(
        self, task: PipelineTask, input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Translate a PipelineTask + the previous step's output into the raw
        payload dict the Orchestrator expects:
        ``{"task_type", "input"|"audio", "config"}``.
        """
        internal_task_type = _INTERNAL_TASK_TYPE.get(task.taskType)
        language = task.config.language.model_dump(exclude_none=True)

        if task.taskType == TaskType.ASR:
            config: Dict[str, Any] = {
                "serviceId": task.config.serviceId,
                "language": language,
            }
            if task.config.audioFormat:
                config["audioFormat"] = task.config.audioFormat
            if task.config.preProcessors:
                config["preProcessors"] = task.config.preProcessors
            if task.config.postProcessors:
                config["postProcessors"] = task.config.postProcessors
            if task.config.transcriptionFormat:
                config["transcriptionFormat"] = task.config.transcriptionFormat

            payload: Dict[str, Any] = {
                "task_type": internal_task_type,
                "audio": input_data.get("audio", []),
                "config": config,
            }
            return payload

        if task.taskType in (TaskType.TRANSLATION, TaskType.TRANSLITERATION):
            return {
                "task_type": internal_task_type,
                "input": input_data.get("input", []),
                "config": {
                    "serviceId": task.config.serviceId,
                    "language": language,
                },
            }

        if task.taskType == TaskType.TTS:
            return {
                "task_type": internal_task_type,
                "input": input_data.get("input", []),
                "config": {
                    "serviceId": task.config.serviceId,
                    "language": language,
                    "gender": task.config.gender or "male",
                    "audioFormat": task.config.audioFormat or "wav",
                    "samplingRate": 22050,
                    "encoding": "base64",
                },
            }

        # Sequencing validation already restricts task types; this guards
        # against a future enum member added without an execution branch.
        raise ValueError(f"Unsupported pipeline task type: {task.taskType.value}")

    def _transform_output_for_next_task(
        self, task_type: TaskType, output: PipelineTaskOutput
    ) -> Dict[str, Any]:
        """
        Convert a task's output into the input envelope of the next task.

        * ASR / TRANSLITERATION → text input keyed on the transcript (``source``)
        * TRANSLATION → text input keyed on the translated text (``target``)
        * TTS → terminal task; passed through unchanged
        """
        if task_type in (TaskType.ASR, TaskType.TRANSLITERATION):
            transformed: Dict[str, Any] = {"input": []}
            for item in output.output or []:
                source_text = (item.get("source") or "").strip()
                if not source_text:
                    raise ValueError(
                        f"{task_type.value} task produced empty text; "
                        "cannot proceed to the next task."
                    )
                transformed["input"].append({"source": source_text})
            return transformed

        if task_type == TaskType.TRANSLATION:
            transformed = {"input": []}
            for item in output.output or []:
                translated_text = (item.get("target") or "").strip()
                if not translated_text:
                    raise ValueError(
                        "Translation task produced empty result; "
                        "cannot proceed to TTS."
                    )
                transformed["input"].append({"source": translated_text})
            return transformed

        # TTS is terminal — there is no next task to feed.
        return {"audio": output.audio or []}
