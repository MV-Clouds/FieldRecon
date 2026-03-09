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
}