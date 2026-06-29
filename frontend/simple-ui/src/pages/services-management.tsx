// Services Management page with list, create, view, update, and delete functionality

import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  HStack,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import Head from "next/head";
import { ViewIcon, DeleteIcon } from "@chakra-ui/icons";
import { FaUpload, FaDownload } from "react-icons/fa";
import React from "react";
import ContentLayout from "../components/common/ContentLayout";
import ManagementPageHeader from "../components/common/ManagementPageHeader";
import ConfirmDialog from "../components/common/ConfirmDialog";
import AdminDataTable, {
  TableSearchField,
  TableSelectField,
} from "../components/common/AdminDataTable";
import { MODEL_TASK_TYPE_LIST, formatModelTaskTypeLabel, PAGINATION, SERVICE_PUBLISH } from "../constants";
import { EMPTY_CREATE_SERVICE_FORM } from "../utils/servicesManagementPage";
import { useServicesManagementPage } from "../hooks/useServicesManagementPage";

const ServicesManagementPage: React.FC = () => {
  const {
    cardBg,
    cardBorder,
    isRegistryReadOnly,
    activeTab,
    setActiveTab,
    viewTabIndex,
    isViewingService,
    setIsViewingService,
    selectedService,
    setSelectedService,
    setSelectedServiceModelDeprecated,
    router,
    registryTableItems,
    serviceColumns,
    filterStatus,
    filterTaskType,
    registryEpoch,
    isLoading,
    services,
    hasActiveFilters,
    clearAllFilters,
    searchQuery,
    setSearchQuery,
    setFilterStatus,
    setFilterTaskType,
    handleViewService,
    formData,
    setFormData,
    handleSubmit,
    handleInputChange,
    handleModelNameChange,
    isLoadingModels,
    modelsForDropdown,
    isCreateFormModelSelected,
    canCreateService,
    isSubmitting,
    setPreselectedModelFromQuery,
    isEditingService,
    selectedServiceModelDeprecated,
    isServiceModelDeprecated,
    unpublishingServiceUuid,
    publishingServiceUuid,
    setConfirmUnpublishService,
    onUnpublishConfirmOpen,
    setConfirmPublishService,
    onPublishConfirmOpen,
    handleDeleteConfirm,
    isOpen,
    onClose,
    serviceToDelete,
    deletingServiceUuid,
    cancelRef,
    isPublishConfirmOpen,
    onPublishConfirmClose,
    handlePublishConfirm,
    confirmPublishService,
    cancelPublishRef,
    isUnpublishConfirmOpen,
    onUnpublishConfirmClose,
    handleUnpublishConfirm,
    confirmUnpublishService,
    cancelUnpublishRef,
    getServiceTaskColor,
  } = useServicesManagementPage();

  return (
    <>
      <Head>
        <title>Services Management - AI4I Platform</title>
        <meta name="description" content="Manage and configure services" />
      </Head>

      <ContentLayout>
        <VStack spacing={6} w="full">
          <ManagementPageHeader
            title="Services Management"
            description={
              isRegistryReadOnly
                ? "View services in the registry (read-only)"
                : "Manage and configure services"
            }
          />

          <Grid gap={8} w="full" mx="auto">
            <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px">
              <Tabs
                colorScheme="blue"
                variant="enclosed"
                index={activeTab}
                onChange={(index) => {
                  if (isRegistryReadOnly && index === 1) return;
                  setActiveTab(index);
                  if (index !== viewTabIndex) {
                    setIsViewingService(false);
                    setSelectedService(null);
                    setSelectedServiceModelDeprecated(null);
                  }
                  const q = { ...router.query } as Record<string, string>;
                  if (index === 0) delete q.tab;
                  else q.tab = String(index);
                  router.replace({ pathname: "/services-management", query: q }, undefined, { shallow: true });
                }}
              >
                <TabList>
                  <Tab fontWeight="semibold">Service Registry</Tab>
                  {!isRegistryReadOnly && (
                    <Tab fontWeight="semibold">Create Service</Tab>
                  )}
                  {isViewingService && (
                    <Tab fontWeight="semibold">View Service</Tab>
                  )}
                </TabList>

                <TabPanels>
                  {/* Service Registry Tab */}
                  <TabPanel px={0} pt={6}>
                    <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px" boxShadow="none">
                      <CardHeader>
                        <Heading size="md" color="gray.700" userSelect="none" cursor="default">
                          Service Registry
                        </Heading>
                      </CardHeader>
                      <CardBody>
                        <AdminDataTable
                          key={`${filterStatus}-${filterTaskType}-${registryEpoch}`}
                          items={registryTableItems}
                          columns={serviceColumns}
                          getRowKey={(service) =>
                            service.serviceId || service.service_id || ""
                          }
                          onRowClick={(service) =>
                            handleViewService(service.serviceId || service.service_id || "")
                          }
                          paginate="client"
                          pageSizeOptions={PAGINATION.TABLE_PAGE_SIZE_OPTIONS}
                          isLoading={isLoading}
                          loadingMessage="Loading services..."
                          emptyMessage="No services in the registry yet."
                          noResultsMessage="No results found. Try adjusting your search or filters."
                          unfilteredCount={services.length}
                          hasActiveFilters={hasActiveFilters}
                          onClearFilters={clearAllFilters}
                          filters={
                            <VStack align="stretch" spacing={3} w="full">
                              <HStack flexWrap="wrap" spacing={3} align="flex-end">
                                <TableSearchField
                                  label="Search"
                                  value={searchQuery}
                                  onChange={setSearchQuery}
                                  placeholder="Search by service name..."
                                  formControlProps={{ w: { base: "full", md: "280px" } }}
                                />
                                <TableSelectField
                                  label="Status"
                                  value={filterStatus}
                                  onChange={setFilterStatus}
                                  formControlProps={{ w: { base: "full", sm: "140px" } }}
                                >
                                  <option value="">All</option>
                                  <option value={SERVICE_PUBLISH.FILTER.PUBLISHED}>{SERVICE_PUBLISH.LABEL.PUBLISHED}</option>
                                  <option value={SERVICE_PUBLISH.FILTER.UNPUBLISHED}>{SERVICE_PUBLISH.LABEL.UNPUBLISHED}</option>
                                </TableSelectField>
                                <TableSelectField
                                  label="Model Task Type"
                                  value={filterTaskType}
                                  onChange={setFilterTaskType}
                                  formControlProps={{ w: { base: "full", sm: "160px" } }}
                                >
                                  <option value="">All</option>
                                  {MODEL_TASK_TYPE_LIST.map((t) => (
                                    <option key={t} value={t}>
                                      {formatModelTaskTypeLabel(t)}
                                    </option>
                                  ))}
                                </TableSelectField>
                              </HStack>
                              {hasActiveFilters && (
                                <HStack spacing={2} flexWrap="wrap">
                                  {searchQuery.trim() && (
                                    <Badge
                                      colorScheme="blue"
                                      fontSize="xs"
                                      px={2}
                                      py={1}
                                      cursor="pointer"
                                      onClick={() => setSearchQuery("")}
                                      _hover={{ opacity: 0.8 }}
                                    >
                                      Search: &quot;{searchQuery.trim()}&quot; ×
                                    </Badge>
                                  )}
                                  {filterStatus && (
                                    <Badge
                                      colorScheme="gray"
                                      fontSize="xs"
                                      px={2}
                                      py={1}
                                      cursor="pointer"
                                      onClick={() => setFilterStatus("")}
                                      _hover={{ opacity: 0.8 }}
                                    >
                                      Status:{" "}
                                      {filterStatus === SERVICE_PUBLISH.FILTER.PUBLISHED ? SERVICE_PUBLISH.LABEL.PUBLISHED : SERVICE_PUBLISH.LABEL.UNPUBLISHED}{" "}
                                      ×
                                    </Badge>
                                  )}
                                  {filterTaskType && (
                                    <Badge
                                      colorScheme="gray"
                                      fontSize="xs"
                                      px={2}
                                      py={1}
                                      cursor="pointer"
                                      onClick={() => setFilterTaskType("")}
                                      _hover={{ opacity: 0.8 }}
                                    >
                                      Model Task Type: {formatModelTaskTypeLabel(filterTaskType)} ×
                                    </Badge>
                                  )}
                                </HStack>
                              )}
                            </VStack>
                          }
                        />
                      </CardBody>
                    </Card>
                  </TabPanel>

                  {/* Create Service Tab */}
                  {!isRegistryReadOnly && (
                  <TabPanel px={0} pt={6}>
                    <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px" boxShadow="none">
                      <CardHeader>
                        <Heading size="md" color="gray.700" userSelect="none" cursor="default">
                          Create New Service
                        </Heading>
                      </CardHeader>
                      <CardBody>
                        <form onSubmit={handleSubmit}>
                          <VStack spacing={6} align="stretch">
                            <FormControl isRequired>
                              <FormLabel fontWeight="semibold">
                                Service Name{" "}
                              </FormLabel>
                              <Input
                                value={formData.name || ""}
                                onChange={(e) => handleInputChange("name", e.target.value)}
                                placeholder="Enter service name e.g. asr-conformer-gpu"
                                bg="white"
                              />
                              <Text fontSize="xs" color="gray.500" mt={1}>
                                Enter service name e.g. asr-conformer-gpu. Service ID will be auto-generated based on this.
                              </Text>
                            </FormControl>

                            <FormControl isRequired>
                              <FormLabel fontWeight="semibold">
                                Service Description{" "}
                              </FormLabel>
                              <Textarea
                                value={formData.serviceDescription || ""}
                                onChange={(e) => handleInputChange("serviceDescription", e.target.value)}
                                placeholder="Provide a brief description of what this service does"
                                bg="white"
                                rows={4}
                              />
                            </FormControl>

                            <FormControl isRequired>
                              <FormLabel fontWeight="semibold">
                                Endpoint{" "}
                              </FormLabel>
                              <Input
                                value={formData.endpoint || ""}
                                onChange={(e) => handleInputChange("endpoint", e.target.value)}
                                placeholder="Enter endpoint URL, e.g. http://localhost:8088"
                                bg="white"
                              />
                              <Text fontSize="xs" color="gray.500" mt={1}>
                                Enter the full HTTP endpoint where this service is hosted.
                              </Text>
                            </FormControl>

                            <FormControl isRequired>
                              <FormLabel fontWeight="semibold">
                                Model Name{" "}
                              </FormLabel>
                              <Select
                                value={formData.modelId || ""}
                                onChange={(e) => handleModelNameChange(e.target.value)}
                                placeholder={isLoadingModels ? "Loading models..." : "Select the model to be associated with this service"}
                                bg="white"
                                isDisabled={isLoadingModels}
                              >
                                {modelsForDropdown.map((model) => (
                                  <option key={model.modelId || model.model_id} value={model.modelId || model.model_id}>
                                    {model.name || model.modelId || model.model_id}
                                  </option>
                                ))}
                              </Select>
                              <Text fontSize="xs" color="gray.500" mt={1}>
                                Select the model to be associated with this service.
                              </Text>
                            </FormControl>

                            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                              <FormControl isRequired>
                                <FormLabel fontWeight="semibold">Model ID</FormLabel>
                                <Input
                                  value={formData.modelId || ""}
                                  bg={isCreateFormModelSelected ? "gray.50" : "white"}
                                  isReadOnly
                                  placeholder="Select a model above"
                                />
                              </FormControl>

                              <FormControl isRequired>
                                <FormLabel fontWeight="semibold">Model Task Type</FormLabel>
                                <Input
                                  value={formData.task_type || ""}
                                  placeholder="Select a model above"
                                  bg={isCreateFormModelSelected ? "gray.50" : "white"}
                                  isReadOnly
                                />
                              </FormControl>
                            </SimpleGrid>

                            <FormControl>
                              <FormLabel fontWeight="semibold">
                                Model Submission Date{" "}
                              </FormLabel>
                              <Input
                                type="date"
                                value={(formData.modelSubmissionDate as string) || ""}
                                placeholder="Select a model above"
                                bg={isCreateFormModelSelected ? "gray.50" : "white"}
                                isReadOnly
                              />
                            </FormControl>

                            <HStack justify="flex-end" spacing={4} pt={4}>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setFormData({ ...EMPTY_CREATE_SERVICE_FORM });
                                  setPreselectedModelFromQuery(null);
                                }}
                              >
                                Reset
                              </Button>
                              <Button
                                type="submit"
                                colorScheme="blue"
                                isLoading={isSubmitting}
                                loadingText="Creating..."
                                isDisabled={!canCreateService || isSubmitting}
                              >
                                Create Service
                              </Button>
                            </HStack>
                          </VStack>
                        </form>
                      </CardBody>
                    </Card>
                  </TabPanel>
                  )}

                  {/* View Service Tab */}
                  {isViewingService && selectedService ? (
                    <TabPanel px={0} pt={6}>
                      <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px" boxShadow="none">
                        <CardHeader>
                          <Heading size="md" color="gray.700" userSelect="none" cursor="default">
                            {selectedService.name || selectedService.serviceId || selectedService.service_id}
                          </Heading>
                        </CardHeader>
                        <CardBody>
                          {!isEditingService && (
                            // View Mode - Display service details
                            <VStack spacing={6} align="stretch">
                              {isRegistryReadOnly && (
                                <Badge colorScheme="gray" alignSelf="flex-start" fontSize="sm" px={2} py={1}>
                                  Read-only
                                </Badge>
                              )}
                              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                <Box>
                                  <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                    Service ID
                                  </Text>
                                  <Text fontSize="md">{selectedService.serviceId || selectedService.service_id || "N/A"}</Text>
                                </Box>
                                <Box>
                                  <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                    Name
                                  </Text>
                                  <Text fontSize="md">{selectedService.name || "N/A"}</Text>
                                </Box>
                              </SimpleGrid>

                              <Box>
                                <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                  Description
                                </Text>
                                <Text fontSize="md">{selectedService.serviceDescription || selectedService.description || "N/A"}</Text>
                              </Box>

                              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                <Box>
                                  <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                    Model Task Type
                                  </Text>
                                  <Badge
                                    colorScheme={getServiceTaskColor(selectedService?.model?.task?.type || selectedService?.task?.type || selectedService.task_type)}
                                    fontSize="sm"
                                    p={2}
                                  >
                                    {(selectedService?.model?.task?.type || selectedService?.task?.type || selectedService.task_type)?.toUpperCase() || "N/A"}
                                  </Badge>
                                </Box>
                                <Box>
                                  <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                    Status (Publish/Unpublish)
                                  </Text>
                                  <HStack spacing={2} align="center" flexWrap="wrap">
                                    <Badge
                                      colorScheme={selectedService.isPublished === true ? "green" : "gray"}
                                      fontSize="sm"
                                      p={2}
                                    >
                                      {selectedService.isPublished === true ? "Published" : "Unpublished"}
                                    </Badge>
                                    {!isRegistryReadOnly &&
                                      (selectedService.isPublished === true ? (
                                        <Tooltip label="Unpublish" placement="top" hasArrow>
                                          <IconButton
                                            aria-label="Unpublish"
                                            icon={<FaDownload />}
                                            size="sm"
                                            colorScheme="red"
                                            variant="outline"
                                            onClick={() => { setConfirmUnpublishService(selectedService); onUnpublishConfirmOpen(); }}
                                            isLoading={unpublishingServiceUuid === selectedService.serviceId}
                                            isDisabled={unpublishingServiceUuid !== null || publishingServiceUuid !== null}
                                          />
                                        </Tooltip>
                                      ) : (
                                        <Tooltip
                                          label={isServiceModelDeprecated(selectedService) || selectedServiceModelDeprecated === true ? "This service cannot be published because its associated model is deprecated. Restore the model to ACTIVE before publishing." : "Publish"}
                                          hasArrow
                                          placement="top"
                                        >
                                          <Box as="span" display="inline-block">
                                            <IconButton
                                              aria-label="Publish"
                                              icon={<FaUpload />}
                                              size="sm"
                                              colorScheme="green"
                                              variant="outline"
                                              onClick={() => { setConfirmPublishService(selectedService); onPublishConfirmOpen(); }}
                                              isLoading={publishingServiceUuid === selectedService.serviceId}
                                              isDisabled={
                                                unpublishingServiceUuid !== null ||
                                                publishingServiceUuid !== null ||
                                                isServiceModelDeprecated(selectedService) ||
                                                selectedServiceModelDeprecated === true
                                              }
                                            />
                                          </Box>
                                        </Tooltip>
                                      ))}
                                  </HStack>
                                </Box>
                              </SimpleGrid>

                              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                <Box>
                                  <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                    Model ID
                                  </Text>
                                  <Text fontSize="md">{selectedService.modelId || selectedService.model_id || "N/A"}</Text>
                                </Box>
                                <Box>
                                  <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                    Endpoint
                                  </Text>
                                  <Text fontSize="md" wordBreak="break-all">
                                    {selectedService.endpoint || selectedService.endpoint_url || "N/A"}
                                  </Text>
                                </Box>
                              </SimpleGrid>

                              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                <Box>
                                  <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                    Hardware Description
                                  </Text>
                                  <Text fontSize="md">{selectedService.hardwareDescription || "N/A"}</Text>
                                </Box>
                                <Box>
                                  <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                    Published On
                                  </Text>
                                  <Text fontSize="md">
                                    {selectedService.publishedOn
                                      ? new Date(selectedService.publishedOn * 1000).toLocaleString()
                                      : "N/A"}
                                  </Text>
                                </Box>
                              </SimpleGrid>

                              {selectedService.created_at && (
                                <Box>
                                  <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                    Created At
                                  </Text>
                                  <Text fontSize="md">
                                    {new Date(selectedService.created_at).toLocaleString()}
                                  </Text>
                                </Box>
                              )}

                              {selectedService.updated_at && (
                                <Box>
                                  <Text fontWeight="bold" color="gray.600" fontSize="sm" mb={1}>
                                    Updated At
                                  </Text>
                                  <Text fontSize="md">
                                    {new Date(selectedService.updated_at).toLocaleString()}
                                  </Text>
                                </Box>
                              )}
                            </VStack>
                          )}
                          {/* Editing disabled for services after creation - edit form removed */}
                        </CardBody>
                      </Card>
                    </TabPanel>
                  ) : null}
                </TabPanels>
              </Tabs>
            </Card>
          </Grid>
        </VStack>
      </ContentLayout>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleDeleteConfirm}
        title="Delete service"
        body={
          <>
            Are you sure you want to delete the service{" "}
            <strong>{serviceToDelete?.name || serviceToDelete?.service_id}</strong>?
            This action cannot be undone.
          </>
        }
        confirmColorScheme="red"
        isConfirmLoading={deletingServiceUuid === serviceToDelete?.serviceId}
        confirmLoadingText="Deleting..."
        leastDestructiveRef={cancelRef}
      />

      <ConfirmDialog
        isOpen={isPublishConfirmOpen}
        onClose={() => {
          onPublishConfirmClose();
          setConfirmPublishService(null);
        }}
        onConfirm={handlePublishConfirm}
        title="Publish service"
        body={
          <>
            Are you sure you want to publish{" "}
            <strong>{confirmPublishService?.name || confirmPublishService?.serviceId}</strong>?
            The service will be available for use.
          </>
        }
        confirmColorScheme="green"
        isConfirmLoading={publishingServiceUuid === confirmPublishService?.serviceId}
        confirmLoadingText="Publishing..."
        leastDestructiveRef={cancelPublishRef}
      />

      <ConfirmDialog
        isOpen={isUnpublishConfirmOpen}
        onClose={() => {
          onUnpublishConfirmClose();
          setConfirmUnpublishService(null);
        }}
        onConfirm={handleUnpublishConfirm}
        title="Unpublish service"
        body={
          <>
            Are you sure you want to unpublish{" "}
            <strong>{confirmUnpublishService?.name || confirmUnpublishService?.serviceId}</strong>?
            The service will no longer be available for use.
          </>
        }
        confirmColorScheme="red"
        isConfirmLoading={unpublishingServiceUuid === confirmUnpublishService?.serviceId}
        confirmLoadingText="Unpublishing..."
        leastDestructiveRef={cancelUnpublishRef}
      />
    </>
  );
};

export default ServicesManagementPage;
