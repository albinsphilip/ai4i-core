// Services Management page with list, create, view, update, and delete functionality

import {
  Card,
  Grid,
  Tab,
  TabList,
  TabPanels,
  Tabs,
  VStack,
} from "@chakra-ui/react";
import Head from "next/head";
import React from "react";
import ContentLayout from "../components/common/ContentLayout";
import ManagementPageHeader from "../components/common/ManagementPageHeader";
import {
  CreateServicePanel,
  ServiceRegistryPanel,
  ServicesManagementConfirmDialogs,
  ViewServicePanel,
} from "../components/services-management/ServicesManagementPanels";
import { useServicesManagementPage } from "../hooks/useServicesManagementPage";

const ServicesManagementPage: React.FC = () => {
  const page = useServicesManagementPage();

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
              page.isRegistryReadOnly
                ? "View services in the registry (read-only)"
                : "Manage and configure services"
            }
          />

          <Grid gap={8} w="full" mx="auto">
            <Card bg={page.cardBg} borderColor={page.cardBorder} borderWidth="1px">
              <Tabs
                colorScheme="blue"
                variant="enclosed"
                index={page.activeTab}
                onChange={page.handleMainTabChange}
              >
                <TabList>
                  <Tab fontWeight="semibold">Service Registry</Tab>
                  {!page.isRegistryReadOnly && (
                    <Tab fontWeight="semibold">Create Service</Tab>
                  )}
                  {page.isViewingService && (
                    <Tab fontWeight="semibold">View Service</Tab>
                  )}
                </TabList>

                <TabPanels>
                  <ServiceRegistryPanel {...page} />
                  {!page.isRegistryReadOnly && <CreateServicePanel {...page} />}
                  {page.isViewingService && selectedServicePresent(page) && (
                    <ViewServicePanel {...page} />
                  )}
                </TabPanels>
              </Tabs>
            </Card>
          </Grid>
        </VStack>
      </ContentLayout>

      <ServicesManagementConfirmDialogs {...page} />
    </>
  );
};

function selectedServicePresent(page: ReturnType<typeof useServicesManagementPage>): boolean {
  return page.selectedService != null;
}

export default ServicesManagementPage;
