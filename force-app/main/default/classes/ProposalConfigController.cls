public with sharing class ProposalConfigController {

    @AuraEnabled(cacheable=true)
    public static ProposalConfigData getProposalConfig() {
        try {
            ProposalConfigData result = new ProposalConfigData();
            
            List<wfrecon__Proposal_Config__mdt> configs = [
                SELECT wfrecon__Config_JSON__c 
                FROM wfrecon__Proposal_Config__mdt 
                WHERE DeveloperName = 'ProposalConfig' 
                LIMIT 1
            ];
            
            if (!configs.isEmpty() && configs[0].wfrecon__Config_JSON__c != null) {
                result.configJson = configs[0].wfrecon__Config_JSON__c;
            } else {
                result.configJson = '{}';
            }
            
            return result;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ProposalConfigController', 'methodName' => 'getProposalConfig', 'exceptionObj' => e, 'moreDetails' => e.getMessage()});
            return null;
        }
    }

    @AuraEnabled
    public static void saveProposalConfig(String configJson) {
        try {
            // Validate it's valid JSON before saving
            JSON.deserializeUntyped(configJson);

            Metadata.CustomMetadata mdata = new Metadata.CustomMetadata();
            mdata.fullName = 'wfrecon__Proposal_Config__mdt.ProposalConfig';
            mdata.label = 'ProposalConfig';

            Metadata.CustomMetadataValue val = new Metadata.CustomMetadataValue();
            val.field = 'wfrecon__Config_JSON__c';
            val.value = configJson;

            mdata.values.add(val);

            Metadata.DeployContainer container = new Metadata.DeployContainer();
            container.addMetadata(mdata);
            Metadata.Operations.enqueueDeployment(container, null);

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ProposalConfigController', 'methodName' => 'saveProposalConfig', 'exceptionObj' => e, 'moreDetails' => e.getMessage()});
        }
    }

    public class ProposalConfigData {
        @AuraEnabled public String configJson;
    }
}
