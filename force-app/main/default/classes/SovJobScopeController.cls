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
                SELECT Id, Process_Library__c , Process_Library__r.Name,
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
            newProcess.Job__c = (Id) processData.get('jobId');
            
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
    @return          : List<Process__c> - List of Process Library records
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<Process__c> getProcessLibraryRecords() {
        List<Process__c> processes = new List<Process__c>();
        try {
            processes = [
                SELECT Id, Name, Process_Name__c, Process_Type__c, 
                       Measurement_Type__c, Sequence__c, Value__c,
                       Process_Description__c
                FROM Process__c
                WITH USER_MODE
                ORDER BY Process_Type__c ASC, Sequence__c ASC NULLS LAST, Name ASC
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
            Id jobId = (Id) processData.get('jobId');
            
            // Fix: Handle List<Object> conversion to List<String>
            List<Object> selectedProcessIdsObj = (List<Object>) processData.get('selectedProcessIds');
            List<String> selectedProcessIds = new List<String>();
            
            if (selectedProcessIdsObj != null) {
                for (Object obj : selectedProcessIdsObj) {
                    selectedProcessIds.add(String.valueOf(obj));
                }
            }
            
            if (selectedProcessIds == null || selectedProcessIds.isEmpty()) {
                return 'Error: No processes selected';
            }
            
            // Get Process Library records
            List<Process__c> processLibraryRecords = [
                SELECT Id, Name, Process_Name__c, Process_Type__c, 
                       Measurement_Type__c, Sequence__c, Weight__c   
                FROM Process__c
                WHERE Id IN :selectedProcessIds
                WITH USER_MODE
            ];
            
            // Create Scope Entry Process records with exact same values
            List<Scope_Entry_Process__c> scopeEntryProcesses = new List<Scope_Entry_Process__c>();
            
            for (Process__c process : processLibraryRecords) {
                Scope_Entry_Process__c newScopeProcess = new Scope_Entry_Process__c();
                
                // Required relationship fields
                newScopeProcess.Scope_Entry__c = scopeEntryId;
                newScopeProcess.Process_Library__c = process.Id;
                
                // Copy exact same values from Process Library
                newScopeProcess.Process_Name__c = process.Process_Name__c;
                newScopeProcess.Process_Type__c = process.Process_Type__c;
                newScopeProcess.Measurement_Type__c = process.Measurement_Type__c;
                newScopeProcess.Sequence__c = process.Sequence__c;
                newScopeProcess.Weight__c = process.Weight__c;
                newScopeProcess.Job__c = jobId; // Associate with Job            
                
                scopeEntryProcesses.add(newScopeProcess);
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
                SELECT Process_Type__c
                FROM Process__c
                WHERE Process_Type__c != null
                WITH USER_MODE
                GROUP BY Process_Type__c
                ORDER BY Process_Type__c ASC
               
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

    /*
    *********************************************************
    @description     : Method to get all locations for a job
    @param           : Id jobId - Job Id
    @return          : List<Location__c> - List of Location records
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<Location__c> getJobLocations(Id jobId) {
        List<Location__c> locations = new List<Location__c>();
        try {
            locations = [
                SELECT Id, Name, Square_Feet__c, Crack_Count__c, 
                       Distressed_Edge__c, Distressed_Joint_LF__c, 
                       Misc_Defect_Count__c
                FROM Location__c
                WHERE Job__c = :jobId
                WITH USER_MODE
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getJobLocations',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Job Locations.',
                'apiResponse' => null
            });
        }
        return locations;
    }

    /*
    *********************************************************
    @description     : Method to get existing location processes for a scope entry
    @param           : Id scopeEntryId - Scope Entry Id
    @return          : List<Id> - List of Location IDs that have existing processes
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<Id> getExistingLocationProcesses(Id scopeEntryId) {
        List<Id> existingLocationIds = new List<Id>();
        try {
            // Get all processes for this scope entry
            List<Scope_Entry_Process__c> processes = [
                SELECT Id
                FROM Scope_Entry_Process__c
                WHERE Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
            ];
            
            if (processes.isEmpty()) {
                return existingLocationIds;
            }
            
            // Get location IDs from location processes
            Set<Id> processIds = new Set<Id>();
            for (Scope_Entry_Process__c process : processes) {
                processIds.add(process.Id);
            }
            
            List<Location_Process__c> locationProcesses = [
                SELECT Location__c
                FROM Location_Process__c
                WHERE Scope_Entry_Process__c IN :processIds
                WITH USER_MODE
            ];
            
            for (Location_Process__c lp : locationProcesses) {
                if (lp.Location__c != null && !existingLocationIds.contains(lp.Location__c)) {
                    existingLocationIds.add(lp.Location__c);
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getExistingLocationProcesses',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching existing location processes.',
                'apiResponse' => null
            });
        }
        return existingLocationIds;
    }

    /*
    *********************************************************
    @description     : Method to create location process records for selected locations
    @param           : Map<String, Object> locationData - Contains scopeEntryId and selectedLocationIds
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String createLocationProcesses(Map<String, Object> locationData) {
        try {
            Id scopeEntryId = (Id) locationData.get('scopeEntryId');
            
            // Convert List<Object> to List<String> for location IDs
            List<Object> selectedLocationIdsObj = (List<Object>) locationData.get('selectedLocationIds');
            List<String> selectedLocationIds = new List<String>();
            
            if (selectedLocationIdsObj != null) {
                for (Object obj : selectedLocationIdsObj) {
                    selectedLocationIds.add(String.valueOf(obj));
                }
            }
            
            if (selectedLocationIds == null || selectedLocationIds.isEmpty()) {
                return 'Error: No locations selected';
            }
            
            // Get scope entry to retrieve contract value
            Scope_Entry__c scopeEntry = [
                SELECT Id, Contract_Value__c
                FROM Scope_Entry__c
                WHERE Id = :scopeEntryId
                WITH USER_MODE
                LIMIT 1
            ];
            
            // Get all processes for this scope entry with their weights
            List<Scope_Entry_Process__c> processes = [
                SELECT Id, Weight__c, Sequence__c, Process_Library__c
                FROM Scope_Entry_Process__c
                WHERE Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
                ORDER BY Sequence__c ASC NULLS LAST
            ];
            
            if (processes.isEmpty()) {
                return 'Error: No processes found for this scope entry';
            }
            
            // Calculate total weight
            Decimal totalWeight = 0;
            for (Scope_Entry_Process__c process : processes) {
                totalWeight += (process.Weight__c != null ? process.Weight__c : 0);
            }
            
            if (totalWeight == 0) {
                return 'Error: Total process weight cannot be zero';
            }
            
            // Create location process records
            List<Location_Process__c> locationProcessesToInsert = new List<Location_Process__c>();
            
            for (String locationId : selectedLocationIds) {
                for (Scope_Entry_Process__c process : processes) {
                    // Calculate contract price based on weight
                    Decimal processWeight = (process.Weight__c != null ? process.Weight__c : 0);
                    Decimal contractPrice = (scopeEntry.Contract_Value__c * processWeight) / totalWeight;
                    
                    Location_Process__c locationProcess = new Location_Process__c();
                    locationProcess.Location__c = locationId;
                    locationProcess.Scope_Entry_Process__c = process.Id;
                    locationProcess.Process_Library__c = process.Process_Library__c;
                    locationProcess.Sequence__c = process.Sequence__c;
                    locationProcess.Contract_Price__c = contractPrice;
                    
                    locationProcessesToInsert.add(locationProcess);
                }
            }
            
            if (!locationProcessesToInsert.isEmpty()) {
                insert as user locationProcessesToInsert;
            }
            
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'createLocationProcesses',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while creating location processes.',
                'apiResponse' => null
            });
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Method is used to save inline edits for multiple Scope Entries
    @param           : String updatedScopeEntriesJson - JSON string of updated scope entry records
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String saveScopeEntryInlineEdits(String updatedScopeEntriesJson) {
        try {
            if (String.isBlank(updatedScopeEntriesJson)) {
                return 'Error: No scope entry data provided for update.';
            }

            // Deserialize JSON string into a list of Scope Entry records
            List<Scope_Entry__c> updatedScopeEntries = 
                (List<Scope_Entry__c>) JSON.deserialize(updatedScopeEntriesJson, List<Scope_Entry__c>.class);

            if (updatedScopeEntries == null || updatedScopeEntries.isEmpty()) {
                return 'Error: No scope entry records provided for update.';
            }

            // Perform the DML update with partial success handling
            Database.SaveResult[] results = Database.update(updatedScopeEntries, false, AccessLevel.USER_MODE);

            // Collect any errors and successes
            List<String> failedRecords = new List<String>();
            Integer successCount = 0;
            
            for (Integer i = 0; i < results.size(); i++) {
                if (results[i].isSuccess()) {
                    successCount++;
                } else {
                    String errorMsg = '';
                    for (Database.Error error : results[i].getErrors()) {
                        errorMsg += error.getMessage() + '; ';
                    }
                    failedRecords.add(updatedScopeEntries[i].Id + ': ' + errorMsg);
                }
            }

            if (!failedRecords.isEmpty()) {
                String errorMessage = successCount + ' record(s) updated successfully. Failed records: ' + String.join(failedRecords, ', ');
                return 'Partial Success: ' + errorMessage;
            }

            return 'Success: ' + successCount + ' scope entry(s) updated successfully';

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'saveScopeEntryInlineEdits',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while saving scope entry inline edits.',
                'apiResponse' => null
            });
            return 'Error: ' + e.getMessage();
        }
    }
}