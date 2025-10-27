public with sharing class ManagementTabController {

    public static final String CLASSNAME = 'ManagementTabController';

    @AuraEnabled
    public static List<Process__c> getProcessLibraries() {
        List<Process__c> processLibraries = new List<Process__c>();
        
        try {
            processLibraries = [
                SELECT Id, Name, Process_Name__c, Weight__c, Unit_of_Measure__c, Process_Type__c
                FROM Process__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getProcessLibraries', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Process Libraries', 'apiResponse' => null});
        }

        return processLibraries;
    }
}
