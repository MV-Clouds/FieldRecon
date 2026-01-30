public with sharing class BidProposalController {
    
     /**
     * Method Name: getContactInfo
     * @description: Fetch Contact Email and Phone for the given Contact Id
     * @param contactId - Id of the Contact record
     * @return Contact record with Email and Phone fields
     */
    @AuraEnabled(cacheable=false)
    public static Contact getContactInfo(Id contactId) {
        try {
            if (contactId == null) {
                return new Contact();
            }
            
            // Query Contact Email and Phone
            Contact contactRecord = [
                SELECT Id, Email, Phone
                FROM Contact
                WHERE Id = :contactId
            ];
            
            return contactRecord;
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BidProposalController', 'methodName' => 'getContactInfo', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});

            return null;
        }
    }
    
    /**
     * Method Name: getProposalConfig
     * @description: Fetch default OH, Warranty, and Profit percentages from Custom Settings
     * @return wfrecon__Proposal_Configuration__c record with default percentages
     */
    @AuraEnabled(cacheable=true)
    public static wfrecon__Proposal_Configuration__c getProposalConfig() {
        try {
            // Query custom setting for default values
            wfrecon__Proposal_Configuration__c config = wfrecon__Proposal_Configuration__c.getInstance();
            
            if (config == null) {
                // Return default values if custom setting not configured
                config = new wfrecon__Proposal_Configuration__c();
                config.wfrecon__OH__c = 0;
                config.wfrecon__Warranty__c = 0;
                config.wfrecon__Profit__c = 0;
            }
            
            return config;
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BidProposalController', 'methodName' => 'getProposalConfig', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            
            // Return default values on error
            wfrecon__Proposal_Configuration__c config = new wfrecon__Proposal_Configuration__c();
            config.wfrecon__OH__c = 0;
            config.wfrecon__Warranty__c = 0;
            config.wfrecon__Profit__c = 0;
            return config;
        }
    }
}