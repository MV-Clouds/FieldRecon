public with sharing class ProposalConfigController {
    
    @AuraEnabled(cacheable=true)
    public static wfrecon__Proposal_Configuration__c getProposalConfig() {
        try {
            return wfrecon__Proposal_Configuration__c.getInstance();
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ProposalConfigController', 'methodName' => 'getProposalConfig', 'exceptionObj' => e});
            return null;
        }
    }
    
    @AuraEnabled
    public static void saveProposalConfig(Decimal ohValue, Decimal warrantyValue, Decimal profitValue) {
        try {
            // Get or create instance
        wfrecon__Proposal_Configuration__c config = wfrecon__Proposal_Configuration__c.getInstance();
        
        if (config == null) {
            config = new wfrecon__Proposal_Configuration__c();
        }
        
        // Update values
        config.wfrecon__OH__c = ohValue;
        config.wfrecon__Warranty__c = warrantyValue;
        config.wfrecon__Profit__c = profitValue;
        
        // Simple upsert
        upsert config;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ProposalConfigController', 'methodName' => 'saveProposalConfig', 'exceptionObj' => e});
        }
        
    }
}