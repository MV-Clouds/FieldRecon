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
    @return          : List<wfrecon__Location_Process__c> - List of Location Processes
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<wfrecon__Location_Process__c> getJobLocationProcesses(Id jobId) {
        List<wfrecon__Location_Process__c> processes = new List<wfrecon__Location_Process__c>();
        try {
            processes = [
                SELECT Id, Name, 
                       wfrecon__Contract_Price__c, 
                       wfrecon__Completed_Percentage__c, 
                       wfrecon__Current_Completed_Value__c, 
                       wfrecon__Process_Status__c, 
                       wfrecon__Sequence__c,
                       wfrecon__Location__c,
                       wfrecon__Location__r.Name,
                       wfrecon__Location__r.wfrecon__Job__c,
                       wfrecon__Process_Name__c
                FROM wfrecon__Location_Process__c
                WHERE wfrecon__Location__r.wfrecon__Job__c = :jobId
                WITH USER_MODE
                ORDER BY wfrecon__Location__r.Name ASC, wfrecon__Sequence__c ASC NULLS LAST, CreatedDate ASC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 'methodName' => 'getJobLocationProcesses', 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching Location Processes for Job ID: ' + jobId, 'apiResponse' => null
            });
        }
        return processes;
    }

    /*
    *********************************************************
    @description     : Method is used to batch update Location Process completion percentages
    @param           : List<ProcessUpdateWrapper> processUpdates - List of process updates
    @return          : BatchUpdateResult - Result containing success status and error details
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static BatchUpdateResult batchUpdateProcessCompletion(List<ProcessUpdateWrapper> processUpdates) {
        BatchUpdateResult result = new BatchUpdateResult();
        result.isSuccess = true;
        result.successCount = 0;
        result.errorCount = 0;
        result.errorDetails = new List<String>();
        
        if (processUpdates == null || processUpdates.isEmpty()) {
            result.isSuccess = false;
            result.errorDetails.add('No processes provided for update');
            return result;
        }
        
        try {
            // Get all process IDs
            Set<Id> processIds = new Set<Id>();
            for (ProcessUpdateWrapper updateInstance : processUpdates) {
                processIds.add(updateInstance.processId);
            }
            
            // Query existing processes
            Map<Id, wfrecon__Location_Process__c> processMap = new Map<Id, wfrecon__Location_Process__c>([
                SELECT Id, wfrecon__Completed_Percentage__c 
                FROM wfrecon__Location_Process__c 
                WHERE Id IN :processIds 
                WITH USER_MODE
            ]);
            
            // Prepare processes for update
            List<wfrecon__Location_Process__c> processesToUpdate = new List<wfrecon__Location_Process__c>();
            
            for (ProcessUpdateWrapper updateInstance : processUpdates) {
                if (processMap.containsKey(updateInstance.processId)) {
                    wfrecon__Location_Process__c processToUpdate = processMap.get(updateInstance.processId);
                    processToUpdate.wfrecon__Completed_Percentage__c = updateInstance.completionPercentage;
                    processesToUpdate.add(processToUpdate);
                } else {
                    result.errorCount++;
                    result.errorDetails.add('Process not found: ' + updateInstance.processId);
                }
            }
            
            // Perform batch update
            if (!processesToUpdate.isEmpty()) {
                List<Database.SaveResult> saveResults = Database.update(processesToUpdate, false);
                
                // Process results
                for (Integer i = 0; i < saveResults.size(); i++) {
                    Database.SaveResult saveResult = saveResults[i];
                    if (saveResult.isSuccess()) {
                        result.successCount++;
                    } else {
                        result.errorCount++;
                        String errorMsg = 'Process ID: ' + processesToUpdate[i].Id + ' - ';
                        for (Database.Error error : saveResult.getErrors()) {
                            errorMsg += error.getMessage() + '; ';
                        }
                        result.errorDetails.add(errorMsg);
                    }
                }
            }
            
            // Set overall success status
            result.isSuccess = (result.errorCount == 0);
            result.message = result.isSuccess ? 
                'All processes updated successfully' : 
                'Some processes failed to update';
                
        } catch (Exception e) {
            result.isSuccess = false;
            result.errorCount = processUpdates.size();
            result.message = 'Batch update failed: ' + e.getMessage();
            result.errorDetails.add(e.getMessage());
            
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'batchUpdateProcessCompletion', 'exceptionObj' => e, 'moreDetails' => 'Error occurred during batch update of Location Processes', 'apiResponse' => null});
        }
        
        return result;
    }
    
    // Wrapper class for process updates
    public class ProcessUpdateWrapper {
        @AuraEnabled public Id processId { get; set; }
        @AuraEnabled public Decimal completionPercentage { get; set; }
    }
    
    // Result wrapper for batch update
    public class BatchUpdateResult {
        @AuraEnabled public Boolean isSuccess { get; set; }
        @AuraEnabled public String message { get; set; }
        @AuraEnabled public Integer successCount { get; set; }
        @AuraEnabled public Integer errorCount { get; set; }
        @AuraEnabled public List<String> errorDetails { get; set; }
    }
}