/**
* Class Name: SovJobLocationProcessesController
* Test Class: Pending
* @description: Controller for SOV Job Location Processes Component
* Created Date: 5 October 2025
* Created By: Rachit Shah
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/

public with sharing class SovJobLocationProcessesController {

    public static final string CLASSNAME = 'SovJobLocationProcessesController';

   /*
    *********************************************************
    @description     : Method is used to get all Location Processes for a Job
    @param           : Id jobId - Job Id
    @return          : List<Location_Process__c> - List of Location Processes
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<Location_Process__c> getJobLocationProcesses(Id jobId) {
        List<Location_Process__c> processes = new List<Location_Process__c>();
        try {
            processes = [
                SELECT Id, Name, 
                       Contract_Price__c, 
                       Completed_Percentage__c, 
                       Current_Completed_Value__c, 
                       Process_Status__c, 
                       Sequence__c,
                       Location__c,
                       Location__r.Name,
                       Location__r.Job__c
                FROM Location_Process__c
                WHERE Location__r.Job__c = :jobId
                WITH USER_MODE
                ORDER BY Location__r.Name ASC, Sequence__c ASC NULLS LAST, CreatedDate ASC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getJobLocationProcesses',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Location Processes for Job ID: ' + jobId,
                'apiResponse' => null
            });
        }
        return processes;
    }

    /*
    *********************************************************
    @description     : Method is used to update Location Process completion percentage
    @param           : Id processId - Location Process Id
    @param           : Decimal completionPercentage - New completion percentage
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String updateProcessCompletion(Id processId, Decimal completionPercentage) {
        try {
            Location_Process__c processToUpdate = [
                SELECT Id, Completed_Percentage__c 
                FROM Location_Process__c 
                WHERE Id = :processId 
                WITH USER_MODE
                LIMIT 1
            ];
            
            processToUpdate.Completed_Percentage__c = completionPercentage;
            update as user processToUpdate;
            
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'updateProcessCompletion',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while updating process completion for Process ID: ' + processId,
                'apiResponse' => null
            });
            return 'Error: ' + e.getMessage();
        }
    }
}