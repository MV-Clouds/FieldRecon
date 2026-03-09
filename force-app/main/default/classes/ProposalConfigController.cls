public with sharing class ProposalConfigController {

    @AuraEnabled(cacheable=true)
    public static ProposalConfigData getProposalConfig() {
        try {
            ProposalConfigData result = new ProposalConfigData();
            
            List<wfrecon__Proposal_Config__mdt> configs = [
                SELECT wfrecon__Number_Configs__c,
                       wfrecon__Agreement_Config__c,
                       wfrecon__Footer_Config__c,
                       wfrecon__Limitations_Config__c,
                       wfrecon__Warranty_Config__c
                FROM wfrecon__Proposal_Config__mdt 
                LIMIT 1
            ];
            
            if (!configs.isEmpty()) {
                wfrecon__Proposal_Config__mdt config = configs[0];
                result.numberConfigs = config.wfrecon__Number_Configs__c;
                result.agreementConfig = config.wfrecon__Agreement_Config__c;
                result.footerConfig = config.wfrecon__Footer_Config__c;
                result.limitationsConfig = config.wfrecon__Limitations_Config__c;
                result.warrantyConfig = config.wfrecon__Warranty_Config__c;
            }
            
            return result;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ProposalConfigController', 
                'methodName' => 'getProposalConfig', 
                'exceptionObj' => e, 
                'moreDetails' => e.getMessage()
            });
            return null;
        }
    }

    @AuraEnabled
    public static void saveProposalConfig(String configData) {
        try {
            // Parse the incoming JSON string
            Map<String, Object> configMap = (Map<String, Object>) JSON.deserializeUntyped(configData);
            
            String numberConfigs = (String) configMap.get('numberConfigs');
            String agreementConfig = (String) configMap.get('agreementConfig');
            String footerConfig = (String) configMap.get('footerConfig');
            String limitationsConfig = (String) configMap.get('limitationsConfig');
            String warrantyConfig = (String) configMap.get('warrantyConfig');
            
            // Validate only numberConfigs as JSON
            if (String.isNotBlank(numberConfigs)) {
                JSON.deserializeUntyped(numberConfigs);
            }

            Metadata.CustomMetadata mdata = new Metadata.CustomMetadata();
            mdata.fullName = 'wfrecon__Proposal_Config__mdt.wfrecon__ProposalConfig';
            mdata.label = 'ProposalConfig';

            if (String.isNotBlank(numberConfigs)) {
                Metadata.CustomMetadataValue val1 = new Metadata.CustomMetadataValue();
                val1.field = 'wfrecon__Number_Configs__c';
                val1.value = numberConfigs;
                mdata.values.add(val1);
            }

            if (String.isNotBlank(agreementConfig)) {
                Metadata.CustomMetadataValue val2 = new Metadata.CustomMetadataValue();
                val2.field = 'wfrecon__Agreement_Config__c';
                val2.value = agreementConfig;
                mdata.values.add(val2);
            }

            if (String.isNotBlank(footerConfig)) {
                Metadata.CustomMetadataValue val3 = new Metadata.CustomMetadataValue();
                val3.field = 'wfrecon__Footer_Config__c';
                val3.value = footerConfig;
                mdata.values.add(val3);
            }

            if (String.isNotBlank(limitationsConfig)) {
                Metadata.CustomMetadataValue val4 = new Metadata.CustomMetadataValue();
                val4.field = 'wfrecon__Limitations_Config__c';
                val4.value = limitationsConfig;
                mdata.values.add(val4);
            }

            if (String.isNotBlank(warrantyConfig)) {
                Metadata.CustomMetadataValue val5 = new Metadata.CustomMetadataValue();
                val5.field = 'wfrecon__Warranty_Config__c';
                val5.value = warrantyConfig;
                mdata.values.add(val5);
            }

            Metadata.DeployContainer container = new Metadata.DeployContainer();
            container.addMetadata(mdata);
            Metadata.Operations.enqueueDeployment(container, null);

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ProposalConfigController', 
                'methodName' => 'saveProposalConfig', 
                'exceptionObj' => e, 
                'moreDetails' => e.getMessage()
            });
        }
    }

    public class ProposalConfigData {
        @AuraEnabled public String numberConfigs;
        @AuraEnabled public String agreementConfig;
        @AuraEnabled public String footerConfig;
        @AuraEnabled public String limitationsConfig;
        @AuraEnabled public String warrantyConfig;
    }
}