"""
Pipeline request/response schemas for the multi-task inference pipeline.

Ported from the standalone pipeline-service (app/schemas/pipeline_*.py) and
adapted to this service's conventions:

* Pydantic v2 idioms (`field_validator` / `model_validator`) replace the v1
  `@validator` decorators the original used.
* camelCase field names are kept (sourceLanguage, serviceId, …) because the
  inference TaskServices already accept camelCase config keys, so a pipeline
  task config can be forwarded to the internal Orchestrator unchanged.

The pipeline orchestrates the in-process TaskServices (ASR → NMT → TTS …)
rather than calling sibling microservices over HTTP, so these models describe
the *outer* multi-task contract; each step's per-task payload is built by
``services.pipeline_service.PipelineService``.
"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class TaskType(str, Enum):
    """Pipeline task types (outer contract).

    These map onto the internal Orchestrator ``task_type`` values in
    PipelineService: TRANSLATION → ``NMT``; the rest are 1:1 uppercase.
    """

    ASR = "asr"
    TRANSLATION = "translation"
    TTS = "tts"
    TRANSLITERATION = "transliteration"


class LanguageConfig(BaseModel):
    """Language configuration for a pipeline task."""

    sourceLanguage: str = Field(..., description="Source language code (e.g. 'en', 'hi', 'ta')")
    targetLanguage: Optional[str] = Field(None, description="Target language code (translation)")
    sourceScriptCode: Optional[str] = Field(None, description="Source script code, if applicable")
    targetScriptCode: Optional[str] = Field(None, description="Target script code, if applicable")


class PipelineTaskConfig(BaseModel):
    """Configuration for a single pipeline task."""

    serviceId: str = Field(..., description="Identifier of the AI model/service to use")
    language: LanguageConfig = Field(..., description="Language configuration")

    # ASR-specific
    audioFormat: Optional[str] = Field(None, description="Audio format (ASR/TTS)")
    preProcessors: Optional[List[str]] = Field(None, description="ASR preprocessors")
    postProcessors: Optional[List[str]] = Field(None, description="ASR postprocessors")
    transcriptionFormat: Optional[str] = Field("transcript", description="ASR transcription format")

    # TTS-specific
    gender: Optional[str] = Field(None, description="Voice gender (male/female)")

    # Free-form extras forwarded to the underlying task service config
    additionalParams: Optional[Dict[str, Any]] = Field(None, description="Additional parameters")


class PipelineTask(BaseModel):
    """A single step in the pipeline."""

    taskType: TaskType = Field(..., description="Type of task to execute")
    config: PipelineTaskConfig = Field(..., description="Configuration for the task")


class PipelineInferenceRequest(BaseModel):
    """Top-level multi-task pipeline request."""

    pipelineTasks: List[PipelineTask] = Field(
        ..., description="Tasks executed in sequence", min_length=1
    )
    inputData: Dict[str, Any] = Field(
        ..., description="Initial input data ('audio' for ASR-first, 'input' for Translation-first)"
    )
    controlConfig: Optional[Dict[str, Any]] = Field(
        None, description="Optional control parameters forwarded to each task"
    )

    @field_validator("pipelineTasks")
    @classmethod
    def validate_task_sequence(cls, v: List[PipelineTask]) -> List[PipelineTask]:
        """Enforce the allowed task adjacency rules (ported verbatim from
        pipeline-service): ASR → Translation, Translation → TTS,
        Transliteration → Translation|TTS, capped at 10 tasks."""
        if not v:
            raise ValueError("At least one pipeline task is required")
        if len(v) > 10:
            raise ValueError("Maximum 10 tasks allowed per pipeline")

        for i in range(len(v) - 1):
            current_task = v[i].taskType
            next_task = v[i + 1].taskType

            if current_task == TaskType.ASR:
                if next_task != TaskType.TRANSLATION:
                    raise ValueError("ASR can only be followed by Translation")
            elif current_task == TaskType.TRANSLATION:
                if next_task != TaskType.TTS:
                    raise ValueError("Translation can only be followed by TTS")
            elif current_task == TaskType.TRANSLITERATION:
                if next_task not in {TaskType.TRANSLATION, TaskType.TTS}:
                    raise ValueError(
                        "Transliteration can only be followed by Translation or TTS"
                    )

        return v

    @model_validator(mode="after")
    def validate_input_data(self) -> "PipelineInferenceRequest":
        """Validate that inputData matches the first task's modality."""
        if not self.pipelineTasks:
            return self

        first_task = self.pipelineTasks[0].taskType
        if first_task not in {TaskType.ASR, TaskType.TRANSLATION}:
            raise ValueError("First task in pipeline must be ASR or Translation")

        if first_task == TaskType.ASR:
            if "audio" not in self.inputData:
                raise ValueError('Input data must contain "audio" for an ASR-first pipeline')
            if not isinstance(self.inputData["audio"], list):
                raise ValueError("Input audio must be a list")
            if not self.inputData["audio"]:
                raise ValueError("Input audio list cannot be empty")
            for i, audio_item in enumerate(self.inputData["audio"]):
                if not isinstance(audio_item, dict):
                    raise ValueError(f"Audio item at index {i} must be a dictionary")
                audio_content = (audio_item.get("audioContent") or "").strip()
                audio_uri = (audio_item.get("audioUri") or "").strip()
                if not audio_content and not audio_uri:
                    raise ValueError(
                        f'Audio item at index {i}: at least one of "audioContent" '
                        'or "audioUri" must be provided'
                    )
        elif first_task == TaskType.TRANSLATION:
            if "input" not in self.inputData:
                raise ValueError(
                    'Input data must contain "input" for a Translation-first pipeline'
                )

        return self


class PipelineTaskOutput(BaseModel):
    """Output produced by a single pipeline task."""

    taskType: str = Field(..., description="Task type that produced this output")
    serviceId: str = Field(..., description="Service ID used for this task")
    output: Optional[Any] = Field(None, description="Task output (shape varies by task type)")
    audio: Optional[List[Dict[str, Any]]] = Field(None, description="Audio output (TTS tasks)")
    config: Optional[Dict[str, Any]] = Field(None, description="Response configuration")

    def model_dump(self, **kwargs):  # type: ignore[override]
        kwargs.setdefault("exclude_none", True)
        return super().model_dump(**kwargs)


class PipelineInferenceResponse(BaseModel):
    """Top-level multi-task pipeline response."""

    pipelineResponse: List[PipelineTaskOutput] = Field(
        ..., description="Ordered outputs from each pipeline task"
    )
