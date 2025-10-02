/**
* Class Name: SovJobScopeController
* Test Class: Pending
* @description: Controller for SOV Scope Tab which is in Job Detail Page
* Created Date: 30 September 2025
* Created By: Rachit Shah
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/

public with sharing class SovJobScopeController {

    public static final string CLASSNAME = 'SovJobScopeController';

   /*
    *********************************************************
    @description     : Method is used to dynamically get Scope Entries for a Job
    @param           : Id jobId - Job Id
    @return          : List<SObject> - List of Scope Entries (dynamic fields)
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<SObject> getScopeEntries(Id jobId) {
        List<SObject> scopeEntries = new List<SObject>();
        try {
            String objectName = 'wfrecon__Scope_Entry__c';
            
            // Get all accessible fields dynamically
            String allScopeEntryFields = getAllFields(objectName);
            String allJobFields = getAllFields('wfrecon__Job__c');
            
            if (String.isNotBlank(allScopeEntryFields)) {
                // Build dynamic SOQL with Job relationship fields
                String query = 'SELECT ' + allScopeEntryFields;
                
                // Add Job relationship fields if we have them
                if (String.isNotBlank(allJobFields)) {
                    // Convert Job fields to relationship notation (Job__r.FieldName)
                    String jobRelationshipFields = convertToRelationshipFields(allJobFields, 'wfrecon__Job__r');
                    if (String.isNotBlank(jobRelationshipFields)) {
                        query += ', ' + jobRelationshipFields;
                    }
                }
                
                query += ' FROM ' + objectName +
                        ' WHERE wfrecon__Job__c = :jobId ' +
                        ' ORDER BY CreatedDate DESC';
                
                scopeEntries = Database.query(query, AccessLevel.USER_MODE);
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getScopeEntries',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Scope Entries dynamically.',
                'apiResponse' => null
            });
        }
        return scopeEntries;
    }

    /*
    *********************************************************
    @description     : Method to convert field names to relationship field format
    @param           : String fieldsList - Comma-separated field names
    @param           : String relationshipName - Relationship name (e.g., 'Job__r')
    @return          : String - Comma-separated relationship field names
    @author          : Rachit Shah
    ********************************************************
    */
    private static String convertToRelationshipFields(String fieldsList, String relationshipName) {
        if (String.isBlank(fieldsList) || String.isBlank(relationshipName)) {
            return '';
        }
        
        List<String> fields = fieldsList.split(',');
        List<String> relationshipFields = new List<String>();
        
        for (String field : fields) {
            String trimmedField = field.trim();
            if (String.isNotBlank(trimmedField)) {
                relationshipFields.add(relationshipName + '.' + trimmedField);
            }
        }
        
        return String.join(relationshipFields, ', ');
    }

    /*
    *********************************************************
    @description     : Method is used to get all fields of an object dynamically
    @param           : String objectName - API name of the object
    @return          : String - Comma-separated field names
    @author          : Rachit Shah
    ********************************************************
    */

    private static String getAllFields(String objectName) {
        try {
            Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
            if (globalDescribe.containsKey(objectName)) {
                Schema.SObjectType sObjectType = globalDescribe.get(objectName);
                Schema.DescribeSObjectResult describeResult = sObjectType.getDescribe();
                Map<String, Schema.SObjectField> fieldsMap = describeResult.fields.getMap();
                
                List<String> fieldNames = new List<String>();
                for (String fieldName : fieldsMap.keySet()) {
                    Schema.DescribeFieldResult fieldDescribe = fieldsMap.get(fieldName).getDescribe();
                    if (fieldDescribe.isAccessible()) {
                        fieldNames.add(fieldName);
                    }
                }
                return String.join(fieldNames, ',');
            } else {
                return '';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getAllFields',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching fields dynamically for ' + objectName,
                'apiResponse' => null
            });
            return '';
        }
    }
    

    /*
    *********************************************************
    @description     : Method is used to get Scope Entry Configuration
    @return          : Map<String, Object> - Configuration data
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getScopeEntryConfiguration() {
        Map<String, Object> configData = new Map<String, Object>();
        
        try {
            List<wfrecon__ScopeEntryConfigration__mdt> configs = [
                SELECT FieldsData__c, PageSize__c 
                FROM wfrecon__ScopeEntryConfigration__mdt 
                WITH USER_MODE 
                LIMIT 1
            ];

            if (!configs.isEmpty()) {
                wfrecon__ScopeEntryConfigration__mdt config = configs[0];
                configData.put('fieldsData', config.FieldsData__c);
                configData.put('pageSize', config.PageSize__c);
            }
            else{
                configData.put('fieldsData', '');
                configData.put('pageSize', 10);
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getScopeEntryConfiguration',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Scope Entry Configuration.',
                'apiResponse' => null
            });
        }

        return configData;
    }

    /*
    *********************************************************
    @description     : Method is used to create a new Scope Entry
    @param           : Map<String, Object> scopeEntryData - Scope Entry data
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String createScopeEntry(Map<String, Object> scopeEntryData) {
        try {
            Scope_Entry__c newScopeEntry = new Scope_Entry__c();
            newScopeEntry.Name = (String) scopeEntryData.get('name');
            newScopeEntry.Contract_Value__c = (Decimal) scopeEntryData.get('contractValue');
            newScopeEntry.Description__c = (String) scopeEntryData.get('description');
            newScopeEntry.Job__c = (Id) scopeEntryData.get('jobId');
            newScopeEntry.Type__c = (String) scopeEntryData.get('type'); // Add type field
            
            insert as user newScopeEntry;
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'createScopeEntry',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while creating Scope Entry.',
                'apiResponse' => null
            });
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Method is used to delete multiple Scope Entries
    @param           : List<Id> scopeEntryIds - List of Scope Entry Ids to delete
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String deleteScopeEntries(List<Id> scopeEntryIds) {
        try {
            if (scopeEntryIds.isEmpty()) {
                return 'Error: No records selected for deletion';
            }
            
            List<Scope_Entry__c> scopeEntriesToDelete = [
                SELECT Id 
                FROM Scope_Entry__c 
                WHERE Id IN :scopeEntryIds 
                WITH USER_MODE
            ];
            
            delete as user scopeEntriesToDelete;
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'deleteScopeEntries',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while deleting Scope Entries.',
                'apiResponse' => null
            });
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Method is used to get Scope Entry Process details
    @param           : Id scopeEntryId - Scope Entry Id
    @return          : List<Scope_Entry_Process__c> - List of Process records
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<Scope_Entry_Process__c> getScopeEntryProcesses(Id scopeEntryId) {
        List<Scope_Entry_Process__c> processes = new List<Scope_Entry_Process__c>();
        try {
            processes = [
                SELECT Id, 
                       Sequence__c, Process_Name__c, Contract_Price__c, Completed_Percentage__c, Process_Type__c, Weight__c, Current_Complete_Value__c, Scope_Entry__c
                FROM Scope_Entry_Process__c
                WHERE Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
                ORDER BY Sequence__c ASC NULLS LAST, CreatedDate ASC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getScopeEntryProcesses',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Scope Entry Processes for Scope Entry ID: ' + scopeEntryId,
                'apiResponse' => null
            });
        }
        return processes;
    }

    /*
    *********************************************************
    @description     : Method is used to create a new Scope Entry Process
    @param           : Map<String, Object> processData - Process data
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String createScopeEntryProcess(Map<String, Object> processData) {
        try {
            Scope_Entry_Process__c newProcess = new Scope_Entry_Process__c();
            newProcess.Process_Name__c = (String) processData.get('processName');
            newProcess.Sequence__c = (Decimal) processData.get('sequence');
            newProcess.Process_Type__c = (String) processData.get('processType');
            newProcess.Weight__c = (Decimal) processData.get('weightage');
            newProcess.Measurement_Type__c = (String) processData.get('measurementType');
            newProcess.Scope_Entry__c = (Id) processData.get('scopeEntryId');
            
            insert as user newProcess;
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'createScopeEntryProcess',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while creating Scope Entry Process.',
                'apiResponse' => null
            });
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Method is used to get Process Library records for selection
    @return          : List<wfrecon__Process__c> - List of Process Library records
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<wfrecon__Process__c> getProcessLibraryRecords() {
        List<wfrecon__Process__c> processes = new List<wfrecon__Process__c>();
        try {
            processes = [
                SELECT Id, Name, wfrecon__Process_Name__c, wfrecon__Process_Type__c, 
                       wfrecon__Measurement_Type__c, wfrecon__Sequence__c, wfrecon__Value__c,
                       wfrecon__Process_Description__c
                FROM wfrecon__Process__c
                WITH USER_MODE
                ORDER BY wfrecon__Process_Type__c ASC, wfrecon__Sequence__c ASC NULLS LAST, Name ASC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getProcessLibraryRecords',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Process Library records.',
                'apiResponse' => null
            });
        }
        return processes;
    }

    /*
    *********************************************************
    @description     : Method is used to create multiple Scope Entry Process records from Process Library
    @param           : Map<String, Object> processData - Contains scopeEntryId and selectedProcessIds
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String createScopeEntryProcessesFromLibrary(Map<String, Object> processData) {
        try {
            Id scopeEntryId = (Id) processData.get('scopeEntryId');
            List<String> selectedProcessIds = (List<String>) processData.get('selectedProcessIds');
            
            if (selectedProcessIds == null || selectedProcessIds.isEmpty()) {
                return 'Error: No processes selected';
            }
            
            // Get Process Library records
            List<wfrecon__Process__c> processLibraryRecords = [
                SELECT Id, Name, wfrecon__Process_Name__c, wfrecon__Process_Type__c, 
                       wfrecon__Measurement_Type__c, wfrecon__Sequence__c, wfrecon__Value__c,
                       wfrecon__Process_Description__c
                FROM wfrecon__Process__c
                WHERE Id IN :selectedProcessIds
                WITH USER_MODE
            ];
            
            // Get the highest sequence number for this scope entry
            List<AggregateResult> maxSequenceResult = [
                SELECT MAX(wfrecon__Sequence__c) maxSeq
                FROM wfrecon__Scope_Entry_Process__c
                WHERE wfrecon__Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
            ];
            
            Decimal nextSequence = 1;
            if (!maxSequenceResult.isEmpty() && maxSequenceResult[0].get('maxSeq') != null) {
                nextSequence = (Decimal) maxSequenceResult[0].get('maxSeq') + 1;
            }
            
            // Create Scope Entry Process records
            List<wfrecon__Scope_Entry_Process__c> scopeEntryProcesses = new List<wfrecon__Scope_Entry_Process__c>();
            
            for (wfrecon__Process__c process : processLibraryRecords) {
                wfrecon__Scope_Entry_Process__c newScopeProcess = new wfrecon__Scope_Entry_Process__c();
                newScopeProcess.wfrecon__Scope_Entry__c = scopeEntryId;
                newScopeProcess.wfrecon__Process_Library__c = process.Id;
                newScopeProcess.wfrecon__Process_Name__c = process.wfrecon__Process_Name__c;
                newScopeProcess.wfrecon__Process_Type__c = process.wfrecon__Process_Type__c;
                newScopeProcess.wfrecon__Measurement_Type__c = process.wfrecon__Measurement_Type__c;
                newScopeProcess.wfrecon__Sequence__c = nextSequence;
                newScopeProcess.wfrecon__Weight__c = process.wfrecon__Value__c; // Using Value as Weight
                
                scopeEntryProcesses.add(newScopeProcess);
                nextSequence++;
            }
            
            insert as user scopeEntryProcesses;
            
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'createScopeEntryProcessesFromLibrary',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while creating Scope Entry Processes from Library.',
                'apiResponse' => null
            });
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Method is used to get unique Process Types for filter
    @return          : List<String> - List of unique Process Types
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<String> getProcessTypes() {
        List<String> processTypes = new List<String>();
        try {
            List<AggregateResult> results = [
                SELECT wfrecon__Process_Type__c
                FROM wfrecon__Process__c
                WHERE wfrecon__Process_Type__c != null
                WITH USER_MODE
                GROUP BY wfrecon__Process_Type__c
                ORDER BY wfrecon__Process_Type__c ASC
               
            ];
            
            for (AggregateResult result : results) {
                String processType = (String) result.get('wfrecon__Process_Type__c');
                if (String.isNotBlank(processType)) {
                    processTypes.add(processType);
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getProcessTypes',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Process Types.',
                'apiResponse' => null
            });
        }
        return processTypes;
    }
}