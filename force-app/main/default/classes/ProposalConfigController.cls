public with sharing class ProposalConfigController {

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getProposalConfig() {
        Map<String, Object> defaultResult = new Map<String, Object>{
            'ohValue' => 0,
            'warrantyValue' => 0,
            'profitValue' => 0,
            'warrantyArea' => '',
            'agreement' => '',
            'limitations' => ''
        };
        
        try {
            Map<String, wfrecon__Proposal_Config__mdt> configMap = wfrecon__Proposal_Config__mdt.getAll();
            
            if (configMap.isEmpty()) {
                return defaultResult;
            }
            
            wfrecon__Proposal_Config__mdt config = configMap.values().get(0);
            
            if (config == null || String.isBlank(config.wfrecon__Config_JSON__c)) {
                return defaultResult;
            }
            
            String jsonString = config.wfrecon__Config_JSON__c.trim();
            
            // Check if the value is Base64 encoded (doesn't start with { or [)
            if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) {
                // Decode from Base64
                jsonString = EncodingUtil.base64Decode(jsonString).toString();
            }
            
            Map<String, Object> jsonData = (Map<String, Object>) JSON.deserializeUntyped(jsonString);
            
            // Merge with defaults
            for (String key : defaultResult.keySet()) {
                if (!jsonData.containsKey(key)) {
                    jsonData.put(key, defaultResult.get(key));
                }
            }
            
            return jsonData;
            
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'getProposalConfig Error: ' + e.getMessage());
             ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ProposalConfigController', 
                'methodName' => 'getProposalConfig', 
                'exceptionObj' => e, 
                'moreDetails' => e.getMessage()
            });
            return defaultResult;
        }
    }

    @AuraEnabled
    public static void saveProposalConfig(String configJson) {
        try {
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
            System.debug(LoggingLevel.ERROR, 'saveProposalConfig Error: ' + e.getMessage());
             ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ProposalConfigController', 
                'methodName' => 'saveProposalConfig', 
                'exceptionObj' => e, 
                'moreDetails' => e.getMessage()
            });
        }
    }
    
}