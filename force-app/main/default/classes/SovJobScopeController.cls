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
    @description     : Method is used to dynamically get Scope Entries for a Job with all related processes preloaded
    @param           : Id jobId - Job Id
    @return          : Map<String, Object> - Map containing scope entries, their process data, and process setup flags
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getScopeEntries(Id jobId) {
        Map<String, Object> result = new Map<String, Object>();
        List<SObject> scopeEntries = new List<SObject>();
        Map<Id, Boolean> processSetupFlags = new Map<Id, Boolean>();
        Map<Id, List<Scope_Entry_Process__c>> scopeEntryProcessMap = new Map<Id, List<Scope_Entry_Process__c>>();
    
        try {
            String objectName = 'wfrecon__Scope_Entry__c';
            String allScopeEntryFields = getAllFields(objectName);
            String allJobFields = getAllFields('wfrecon__Job__c');
    
            if (String.isNotBlank(allScopeEntryFields)) {
                // --- Dynamic SOQL for Scope Entries ---
                String query = 'SELECT ' + allScopeEntryFields;
                if (String.isNotBlank(allJobFields)) {
                    String jobRelationshipFields = convertToRelationshipFields(allJobFields, 'wfrecon__Job__r');
                    if (String.isNotBlank(jobRelationshipFields)) {
                        query += ', ' + jobRelationshipFields;
                    }
                }
                query += ' FROM ' + objectName +
                         ' WHERE wfrecon__Job__c = :jobId' +
                         ' ORDER BY CreatedDate DESC';
    
                List<SObject> rawScopeEntries = Database.query(query, AccessLevel.USER_MODE);
                scopeEntries.addAll(rawScopeEntries);
    
                if (!rawScopeEntries.isEmpty()) {
                    // --- Collect all Scope Entry IDs ---
                    Set<Id> scopeEntryIds = new Set<Id>();
                    for (SObject entry : rawScopeEntries) {
                        scopeEntryIds.add(entry.Id);
                    }
    
                    // --- Fetch all related Scope Entry Processes in bulk ---
                    List<Scope_Entry_Process__c> allScopeEntryProcesses = [
                        SELECT Id, Name, Sequence__c, Process_Name__c, 
                               Contract_Price__c, Completed_Percentage__c, 
                               Current_Complete_Value__c, Weight__c, 
                               Process_Library__r.Name, Process_Library__c,
                               IsManual__c, Scope_Entry__c
                        FROM Scope_Entry_Process__c
                        WHERE Scope_Entry__c IN :scopeEntryIds
                        WITH USER_MODE
                        ORDER BY Sequence__c ASC NULLS LAST, CreatedDate ASC
                    ];

                    // --- Group processes by scope entry ---
                    Map<Id, Set<Id>> scopeEntryToProcessIds = new Map<Id, Set<Id>>();
                    for (Scope_Entry_Process__c process : allScopeEntryProcesses) {
                        Id scopeEntryId = process.Scope_Entry__c;
                        
                        // Add to the process map for UI display
                        if (!scopeEntryProcessMap.containsKey(scopeEntryId)) {
                            scopeEntryProcessMap.put(scopeEntryId, new List<Scope_Entry_Process__c>());
                        }
                        scopeEntryProcessMap.get(scopeEntryId).add(process);
                        
                        // Track process IDs for setup flag calculation
                        if (!scopeEntryToProcessIds.containsKey(scopeEntryId)) {
                            scopeEntryToProcessIds.put(scopeEntryId, new Set<Id>());
                        }
                        scopeEntryToProcessIds.get(scopeEntryId).add(process.Id);
                    }
    
                    // --- Fetch all related Location Processes in bulk for setup flag calculation ---
                    Set<Id> allProcessIds = new Set<Id>();
                    for (Set<Id> pIds : scopeEntryToProcessIds.values()) {
                        allProcessIds.addAll(pIds);
                    }
    
                    Set<Id> locationProcessIds = new Set<Id>();
                    if (!allProcessIds.isEmpty()) {
                        for (Location_Process__c locProc : [
                            SELECT Id, Scope_Entry_Process__c
                            FROM Location_Process__c
                            WHERE Scope_Entry_Process__c IN :allProcessIds
                            WITH USER_MODE
                        ]) {
                            locationProcessIds.add(locProc.Scope_Entry_Process__c);
                        }
                    }
    
                    // --- Build setup flag map for each Scope Entry ---
                    for (SObject entry : rawScopeEntries) {
                        Id scopeEntryId = entry.Id;
                        Set<Id> processIds = scopeEntryToProcessIds.get(scopeEntryId);
                        Boolean hasCompleteSetup = (processIds != null && !processIds.isEmpty());
    
                        if (hasCompleteSetup) {
                            // Check if at least one process has a location process
                            Boolean hasLocationProcess = false;
                            for (Id pid : processIds) {
                                if (locationProcessIds.contains(pid)) {
                                    hasLocationProcess = true;
                                    break;
                                }
                            }
                            hasCompleteSetup = hasLocationProcess;
                        }
                        processSetupFlags.put(scopeEntryId, hasCompleteSetup);
                    }
                }
            }
    
            result.put('scopeEntries', scopeEntries);
            result.put('processSetupFlags', processSetupFlags);
            result.put('scopeEntryProcessMap', scopeEntryProcessMap);
            result.put('success', true);
    
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getScopeEntries', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching Scope Entries dynamically (bulk-safe version).','apiResponse' => null});
    
            result.put('scopeEntries', new List<SObject>());
            result.put('processSetupFlags', new Map<Id, Boolean>());
            result.put('scopeEntryProcessMap', new Map<Id, List<Scope_Entry_Process__c>>());
            result.put('success', false);
            result.put('error', e.getMessage());
        }
    
        return result;
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
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getAllFields','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while fetching fields dynamically for ' + objectName,'apiResponse' => null});
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
            List<ScopeEntryConfigration__mdt> configs = [
                SELECT FieldsData__c, PageSize__c 
                FROM ScopeEntryConfigration__mdt 
                WITH USER_MODE 
                LIMIT 1
            ];

            if (!configs.isEmpty()) {
                ScopeEntryConfigration__mdt config = configs[0];
                configData.put('fieldsData', config.FieldsData__c);
                configData.put('pageSize', config.PageSize__c);
            }
            else{
                configData.put('fieldsData', '');
                configData.put('pageSize', 10);
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getScopeEntryConfiguration','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while fetching Scope Entry Configuration.','apiResponse' => null});
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
            newScopeEntry.Scope_Entry_Status__c = 'Draft';
            
            insert as user newScopeEntry;
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'createScopeEntry','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while creating Scope Entry.','apiResponse' => null});
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
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'deleteScopeEntries','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while deleting Scope Entries.','apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
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
            newProcess.IsManual__c = true; // Mark as manual process
            
            insert as user newProcess;
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'createScopeEntryProcess','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while creating Scope Entry Process.','apiResponse' => null});
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
                       Measurement_Type__c, Sequence__c, Weight__c,
                       Process_Description__c
                FROM Process__c
                WITH USER_MODE
                ORDER BY Process_Type__c ASC, Sequence__c ASC NULLS LAST, Name ASC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getProcessLibraryRecords','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while fetching Process Library records.','apiResponse' => null});
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
                newScopeProcess.IsManual__c = false; // Mark as library process           
                
                scopeEntryProcesses.add(newScopeProcess);
            }
            
            insert as user scopeEntryProcesses;
            
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'createScopeEntryProcessesFromLibrary','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while creating Scope Entry Processes from Library.','apiResponse' => null});
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
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getProcessTypes','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while fetching Process Types.','apiResponse' => null});
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
                SELECT Id, Name, Quantity__c, Crack_Count__c, 
                       Distressed_Edge__c, Distressed_Joint_LF__c, 
                       Misc_Defect_Count__c, Unit_of_Measure__c
                FROM Location__c
                WHERE Job__c = :jobId
                WITH USER_MODE
                ORDER BY Name ASC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getJobLocations','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while fetching Job Locations.','apiResponse' => null});
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
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getExistingLocationProcesses','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while fetching existing location processes.','apiResponse' => null});
        }
        return existingLocationIds;
    }

    /*
    *********************************************************
    @description     : Method to create/update location processes for scope entries with proper recalculation
    @param           : Map<String, Object> locationData - Contains scopeEntryId, location changes, and relationship data
    @return          : String - Success or error message
    @author          : Updated to handle existing location processes with recalculation
    ********************************************************
    */
    @AuraEnabled
    public static String createLocationProcesses(Map<String, Object> locationData) {
        try {
            String scopeEntryId = (String) locationData.get('scopeEntryId');
            
            // Get all the location arrays
            List<Object> selectedLocationIdsObj = (List<Object>) locationData.get('selectedLocationIds');
            List<Object> originalLocationIdsObj = (List<Object>) locationData.get('originalLocationIds');
            List<Object> addedLocationIdsObj = (List<Object>) locationData.get('addedLocationIds');
            List<Object> removedLocationIdsObj = (List<Object>) locationData.get('removedLocationIds');
            Boolean hasChanges = (Boolean) locationData.get('hasChanges');
            
            // Convert to String lists
            List<String> selectedLocationIds = convertToStringList(selectedLocationIdsObj);
            List<String> originalLocationIds = convertToStringList(originalLocationIdsObj);
            List<String> addedLocationIds = convertToStringList(addedLocationIdsObj);
            List<String> removedLocationIds = convertToStringList(removedLocationIdsObj);
            
            if (String.isBlank(scopeEntryId)) {
                return 'Error: Scope Entry ID is required';
            }
            
            // Get scope entry to retrieve contract value
            List<Scope_Entry__c> scopeEntries = [
                SELECT Id, Contract_Value__c
                FROM Scope_Entry__c
                WHERE Id = :scopeEntryId
                WITH USER_MODE
                LIMIT 1
            ];
            
            if (scopeEntries.isEmpty()) {
                return 'Error: Scope entry not found';
            }
            
            Scope_Entry__c scopeEntry = scopeEntries[0];
            
            // Get all processes for this scope entry with their weights
            List<Scope_Entry_Process__c> processes = [
                SELECT Id, Weight__c, Sequence__c, Process_Library__c, Process_Name__c, IsManual__c
                FROM Scope_Entry_Process__c
                WHERE Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
                ORDER BY Sequence__c ASC NULLS LAST
            ];
            
            if (processes.isEmpty()) {
                return 'Error: No processes found for this scope entry. Please add processes first.';
            }
            
            // Calculate total weight for process distribution
            Decimal totalWeight = 0;
            for (Scope_Entry_Process__c process : processes) {
                totalWeight += (process.Weight__c != null ? process.Weight__c : 0);
            }
            
            if (totalWeight == 0) {
                return 'Error: Total process weight cannot be zero';
            }
            
            List<Location_Process__c> processesToDelete = new List<Location_Process__c>();
            List<Location_Process__c> processesToCreate = new List<Location_Process__c>();
            List<Location_Process__c> processesToUpdate = new List<Location_Process__c>();
            
            Integer deletedCount = 0;
            Integer createdCount = 0;
            Integer updatedCount = 0;
            
            // 1. Handle removals (delete location processes for removed locations)
            if (!removedLocationIds.isEmpty()) {
                List<Location_Process__c> existingProcessesToDelete = [
                    SELECT Id
                    FROM Location_Process__c
                    WHERE Location__c IN :removedLocationIds
                    AND Scope_Entry_Process__c IN (
                        SELECT Id FROM Scope_Entry_Process__c WHERE Scope_Entry__c = :scopeEntryId
                    )
                    WITH USER_MODE
                ];
                
                if (!existingProcessesToDelete.isEmpty()) {
                    delete as user existingProcessesToDelete;
                    deletedCount = existingProcessesToDelete.size();
                }
            }
            
            // 2. Get final location data for all selected locations (for recalculation)
            if (!selectedLocationIds.isEmpty()) {
                List<Location__c> selectedLocations = [
                    SELECT Id, Quantity__c, Unit_of_Measure__c
                    FROM Location__c
                    WHERE Id IN :selectedLocationIds
                    WITH USER_MODE
                ];
                
                if (selectedLocations.isEmpty()) {
                    return 'Error: Selected locations not found';
                }
                
                // Calculate total quanity footage across all FINAL selected locations
                Decimal totalSquareFeet = 0;
                Map<String, Decimal> locationSquareFeet = new Map<String, Decimal>();
                
                for (Location__c location : selectedLocations) {
                    Decimal sqFt = location.Quantity__c != null ? location.Quantity__c : 0;
                    totalSquareFeet += sqFt;
                    locationSquareFeet.put(location.Id, sqFt);
                }
                
                if (totalSquareFeet == 0) {
                    return 'Error: Total Quantity cannot be zero. Please ensure locations have Quantity values';
                }
                
                // Calculate unit price per Quantity based on FINAL total Quantity footage
                Decimal unitPrice = scopeEntry.Contract_Value__c / totalSquareFeet;
                
                // 3. Create location processes for newly added locations
                if (!addedLocationIds.isEmpty()) {
                    for (String locationId : addedLocationIds) {
                        Decimal locationSqFt = locationSquareFeet.get(locationId);
                        if (locationSqFt == null) continue;
                        
                        Decimal locationContractValue = unitPrice * locationSqFt;
                        
                        // Create location processes for each scope entry process
                        for (Scope_Entry_Process__c process : processes) {
                            Decimal processWeight = (process.Weight__c != null ? process.Weight__c : 0);
                            Decimal processContractPrice = (locationContractValue * processWeight) / totalWeight;
                            
                            Location_Process__c locationProcess = new Location_Process__c();
                            locationProcess.Location__c = locationId;
                            locationProcess.Scope_Entry_Process__c = process.Id;
                            locationProcess.Process_Library__c = process.Process_Library__c;
                            locationProcess.Sequence__c = process.Sequence__c;
                            locationProcess.Contract_Price__c = processContractPrice;
                                                        
                            processesToCreate.add(locationProcess);
                        }
                    }
                    
                    if (!processesToCreate.isEmpty()) {
                        insert as user processesToCreate;
                        createdCount = processesToCreate.size();
                    }
                }
                
                // 4. Update existing location processes (recalculate contract prices based on new total)
                if (hasChanges) {
                    // Get all existing location processes for unchanged locations (need price recalculation)
                    List<String> unchangedLocationIds = new List<String>();
                    for (String locationId : selectedLocationIds) {
                        if (!addedLocationIds.contains(locationId)) {
                            unchangedLocationIds.add(locationId);
                        }
                    }
                    
                    if (!unchangedLocationIds.isEmpty()) {
                        List<Location_Process__c> existingProcessesToUpdate = [
                            SELECT Id, Location__c, Scope_Entry_Process__c, Contract_Price__c
                            FROM Location_Process__c
                            WHERE Location__c IN :unchangedLocationIds
                            AND Scope_Entry_Process__c IN (
                                SELECT Id FROM Scope_Entry_Process__c WHERE Scope_Entry__c = :scopeEntryId
                            )
                            WITH USER_MODE
                        ];
                        
                        // Create a map for quick process weight lookup
                        Map<Id, Decimal> processWeights = new Map<Id, Decimal>();
                        for (Scope_Entry_Process__c process : processes) {
                            processWeights.put(process.Id, process.Weight__c != null ? process.Weight__c : 0);
                        }
                        
                        for (Location_Process__c existingProcess : existingProcessesToUpdate) {
                            String locationId = existingProcess.Location__c;
                            Decimal locationSqFt = locationSquareFeet.get(locationId);
                            
                            if (locationSqFt != null) {
                                Decimal locationContractValue = unitPrice * locationSqFt;
                                Decimal processWeight = processWeights.get(existingProcess.Scope_Entry_Process__c);
                                Decimal newProcessContractPrice = (locationContractValue * processWeight) / totalWeight;
                                
                                existingProcess.Contract_Price__c = newProcessContractPrice;
                                processesToUpdate.add(existingProcess);
                            }
                        }
                        
                        if (!processesToUpdate.isEmpty()) {
                            update processesToUpdate;
                            updatedCount = processesToUpdate.size();
                        }
                    }
                }
            }
            
            // Build success message
            List<String> messages = new List<String>();
            
            if (createdCount > 0) {
                Integer newLocationsCount = addedLocationIds.size();
                messages.add(createdCount + ' process(es) created for ' + newLocationsCount + ' new location(s)');
            }
            
            if (deletedCount > 0) {
                Integer removedLocationsCount = removedLocationIds.size();
                messages.add(deletedCount + ' process(es) removed for ' + removedLocationsCount + ' location(s)');
            }
            
            if (updatedCount > 0) {
                messages.add(updatedCount + ' existing process(es) recalculated');
            }
            
            if (messages.isEmpty()) {
                if (selectedLocationIds.isEmpty()) {
                    return 'Success: All location processes removed';
                } else {
                    return 'Success: No changes were needed';
                }
            }
            
            return 'Success: ' + String.join(messages, ', ');
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'createLocationProcesses','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while creating/updating location processes.','apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Helper method to convert List<Object> to List<String>
    @param           : List<Object> objectList - List of objects to convert
    @return          : List<String> - Converted string list
    @author          : Helper method for type conversion
    ********************************************************
    */
    private static List<String> convertToStringList(List<Object> objectList) {
        List<String> stringList = new List<String>();
        if (objectList != null) {
            for (Object obj : objectList) {
                if (obj != null) {
                    stringList.add(String.valueOf(obj));
                }
            }
        }
        return stringList;
    }


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
    
            // Track contract value changes
            Set<Id> scopeEntriesWithContractValueChanges = new Set<Id>();
            Map<Id, Decimal> originalContractValues = new Map<Id, Decimal>();
            List<Id> scopeEntryIds = new List<Id>();
    
            for (Scope_Entry__c entry : updatedScopeEntries) {
                scopeEntryIds.add(entry.Id);
            }
    
            // Fetch original contract values
            for (Scope_Entry__c original : [
                SELECT Id, Contract_Value__c
                FROM Scope_Entry__c
                WHERE Id IN :scopeEntryIds
                WITH USER_MODE
            ]) {
                originalContractValues.put(original.Id, original.Contract_Value__c);
            }
    
            // Identify records where Contract_Value__c changed
            for (Scope_Entry__c updatedEntry : updatedScopeEntries) {
                Decimal oldVal = originalContractValues.get(updatedEntry.Id);
                Decimal newVal = updatedEntry.Contract_Value__c;
    
                if ((oldVal == null && newVal != null) ||
                    (oldVal != null && newVal == null) ||
                    (oldVal != null && newVal != null && oldVal != newVal)) {
                    scopeEntriesWithContractValueChanges.add(updatedEntry.Id);
                }
            }
    
            // Perform bulk DML update
            Database.SaveResult[] results = Database.update(updatedScopeEntries, false, AccessLevel.USER_MODE);
    
            List<String> failedRecords = new List<String>();
            Integer successCount = 0;
    
            for (Integer i = 0; i < results.size(); i++) {
                if (results[i].isSuccess()) {
                    successCount++;
                } else {
                    String errorMsg = '';
                    for (Database.Error err : results[i].getErrors()) {
                        errorMsg += err.getMessage() + '; ';
                    }
                    failedRecords.add(updatedScopeEntries[i].Id + ': ' + errorMsg);
                }
            }
    
            // Prepare changed entries map for recalculation
            String recalcMessage = '';
            if (!scopeEntriesWithContractValueChanges.isEmpty()) {
                Map<Id, Scope_Entry__c> changedEntries = new Map<Id, Scope_Entry__c>();
                for (Scope_Entry__c se : updatedScopeEntries) {
                    if (scopeEntriesWithContractValueChanges.contains(se.Id)) {
                        changedEntries.put(se.Id, se);
                    }
                }
    
                recalcMessage = recalculateLocationProcessesBulk(changedEntries);
            }
    
            // Build final response
            String responseMessage = '';
            if (!failedRecords.isEmpty()) {
                responseMessage = successCount + ' record(s) updated successfully. Failed records: ' +
                                  String.join(failedRecords, ', ');
                if (!String.isBlank(recalcMessage)) {
                    responseMessage += ' Warnings: ' + recalcMessage;
                }
                return 'Partial Success: ' + responseMessage;
            }
    
            responseMessage = 'Success: ' + successCount + ' scope entry(s) updated successfully';
            if (!String.isBlank(recalcMessage)) {
                responseMessage += '. ' + recalcMessage;
            }
    
            return responseMessage;
    
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'saveScopeEntryInlineEdits','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while saving scope entry inline edits.','apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }
    
    /*
    *********************************************************
    @description     : Bulk recalculation of location processes using in-memory scope entry data
    @param           : Map<Id, Scope_Entry__c> scopeEntries
    @return          : String - Summary message
    *********************************************************
    */
    public static String recalculateLocationProcessesBulk(Map<Id, Scope_Entry__c> scopeEntries) {
        try {
            if (scopeEntries == null || scopeEntries.isEmpty()) {
                return 'No scope entries provided for recalculation.';
            }
    
            Set<Id> scopeEntryIds = scopeEntries.keySet();
    
            // Fetch all scope entry processes (weights)
            Map<Id, List<Scope_Entry_Process__c>> entryToProcesses = new Map<Id, List<Scope_Entry_Process__c>>();
            for (Scope_Entry_Process__c proc : [
                SELECT Id, Scope_Entry__c, Weight__c
                FROM Scope_Entry_Process__c
                WHERE Scope_Entry__c IN :scopeEntryIds
                WITH USER_MODE
            ]) {
                if (!entryToProcesses.containsKey(proc.Scope_Entry__c)) {
                    entryToProcesses.put(proc.Scope_Entry__c, new List<Scope_Entry_Process__c>());
                }
                entryToProcesses.get(proc.Scope_Entry__c).add(proc);
            }
    
            // Fetch all related location processes and include location data
            Map<Id, List<Location_Process__c>> entryToLocationProcesses = new Map<Id, List<Location_Process__c>>();
            List<Location_Process__c> allLocationProcesses = [
                SELECT Id, Scope_Entry_Process__c, Scope_Entry_Process__r.Scope_Entry__c,
                       Location__c, Location__r.Quantity__c, Location__r.Unit_of_Measure__c
                FROM Location_Process__c
                WHERE Scope_Entry_Process__r.Scope_Entry__c IN :scopeEntryIds
                WITH USER_MODE
            ];
    
            for (Location_Process__c lp : allLocationProcesses) {
                Id entryId = lp.Scope_Entry_Process__r.Scope_Entry__c;
                if (!entryToLocationProcesses.containsKey(entryId)) {
                    entryToLocationProcesses.put(entryId, new List<Location_Process__c>());
                }
                entryToLocationProcesses.get(entryId).add(lp);
            }
    
            List<Location_Process__c> locationProcessesToUpdate = new List<Location_Process__c>();
    
            // Iterate per Scope Entry for recalculation
            for (Id entryId : scopeEntryIds) {
                Scope_Entry__c entry = scopeEntries.get(entryId);
                List<Scope_Entry_Process__c> processes = entryToProcesses.get(entryId);
                List<Location_Process__c> locationProcesses = entryToLocationProcesses.get(entryId);
    
                if (entry == null || processes == null || processes.isEmpty() || locationProcesses == null || locationProcesses.isEmpty()) {
                    continue;
                }
    
                Decimal newContractValue = entry.Contract_Value__c != null ? entry.Contract_Value__c : 0;
                if (newContractValue == 0) continue;
    
                // Calculate total process weight
                Decimal totalWeight = 0;
                Map<Id, Decimal> processWeights = new Map<Id, Decimal>();
                for (Scope_Entry_Process__c p : processes) {
                    Decimal w = p.Weight__c != null ? p.Weight__c : 0;
                    processWeights.put(p.Id, w);
                    totalWeight += w;
                }
                if (totalWeight == 0) continue;
    
                // Calculate total square feet across all locations for this entry
                Set<Id> locationIds = new Set<Id>();
                Map<Id, Decimal> locationSqFt = new Map<Id, Decimal>();
                for (Location_Process__c lp : locationProcesses) {
                    locationIds.add(lp.Location__c);
                    Decimal sqFt = (lp.Location__r.Quantity__c != null) ? lp.Location__r.Quantity__c : 0;
                    locationSqFt.put(lp.Location__c, sqFt);
                }
    
                Decimal totalSqFt = 0;
                for (Decimal sqFt : locationSqFt.values()) totalSqFt += sqFt;
                if (totalSqFt == 0) continue;
    
                // Recalculate each Location Process based on the new Contract Value
                for (Location_Process__c lp : locationProcesses) {
                    Decimal locSqFt = locationSqFt.get(lp.Location__c);
                    Decimal locShare = (locSqFt / totalSqFt); // location proportion
                    Decimal procWeight = processWeights.get(lp.Scope_Entry_Process__c);
                    Decimal procShare = (procWeight / totalWeight); // process proportion
    
                    // Final recalculated Contract Price based on new contract value
                    Decimal recalculatedContractPrice = newContractValue * locShare * procShare;
    
                    Location_Process__c lpToUpdate = new Location_Process__c(
                        Id = lp.Id,
                        Contract_Price__c = recalculatedContractPrice
                    );
                    locationProcessesToUpdate.add(lpToUpdate);
                }
            }
    
            if (!locationProcessesToUpdate.isEmpty()) {
                update locationProcessesToUpdate;
            }
    
            return 'Success: Recalculated all location processes using new contract values for ' + scopeEntries.size() + ' scope entries.';
    
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'recalculateLocationProcessesBulk','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error during recalculation using new contract prices.','apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Method is used to save inline edits for multiple Process Entries and automatically recalculate location processes when weightage changes
    @param           : String updatedProcessEntriesJson - JSON string of updated process entry records
    @return          : String - Success or error message with recalculation details
    @author          : Rachit Shah
    @note            : When process weightage is modified, related location processes are automatically
                      recalculated to maintain proper value distribution based on the new weights.
    ********************************************************
    */
    @AuraEnabled
    public static String saveProcessEntryInlineEdits(String updatedProcessEntriesJson) {
        try {
            if (String.isBlank(updatedProcessEntriesJson)) {
                return 'Error: No process entry data provided for update.';
            }

            // Deserialize JSON string into a list of Process Entry records
            List<Scope_Entry_Process__c> updatedProcessEntries = 
                (List<Scope_Entry_Process__c>) JSON.deserialize(updatedProcessEntriesJson, List<Scope_Entry_Process__c>.class);

            if (updatedProcessEntries == null || updatedProcessEntries.isEmpty()) {
                return 'Error: No process entry records provided for update.';
            }

            // Get the IDs of processes being updated
            Set<Id> processIds = new Set<Id>();
            for (Scope_Entry_Process__c process : updatedProcessEntries) {
                if (process.Id != null) {
                    processIds.add(process.Id);
                }
            }

            // Fetch current process data to detect weightage changes
            Map<Id, Decimal> originalWeights = new Map<Id, Decimal>();
            Map<Id, Id> processToScopeEntry = new Map<Id, Id>();
            List<Scope_Entry_Process__c> currentProcesses = [
                SELECT Id, Weight__c, Scope_Entry__c, Scope_Entry__r.Contract_Value__c
                FROM Scope_Entry_Process__c
                WHERE Id IN :processIds
                WITH USER_MODE
            ];

            for (Scope_Entry_Process__c currentProcess : currentProcesses) {
                originalWeights.put(currentProcess.Id, currentProcess.Weight__c);
                processToScopeEntry.put(currentProcess.Id, currentProcess.Scope_Entry__c);
            }

            // Perform the DML update with partial success handling
            Database.SaveResult[] results = Database.update(updatedProcessEntries, false, AccessLevel.USER_MODE);

            // Collect any errors and successes
            List<String> failedRecords = new List<String>();
            Integer successCount = 0;
            Set<Id> affectedScopeEntryIds = new Set<Id>();
            Boolean weightageChanged = false;
            
            for (Integer i = 0; i < results.size(); i++) {
                if (results[i].isSuccess()) {
                    successCount++;
                    
                    // Check if weightage changed for this process
                    Scope_Entry_Process__c updatedProcess = updatedProcessEntries[i];
                    if (updatedProcess.Id != null && originalWeights.containsKey(updatedProcess.Id)) {
                        Decimal originalWeight = originalWeights.get(updatedProcess.Id);
                        Decimal newWeight = updatedProcess.Weight__c;
                        
                        // Compare weights (handle null values)
                        if ((originalWeight == null && newWeight != null) ||
                            (originalWeight != null && newWeight == null) ||
                            (originalWeight != null && newWeight != null && originalWeight != newWeight)) {
                            weightageChanged = true;
                            affectedScopeEntryIds.add(processToScopeEntry.get(updatedProcess.Id));
                        }
                    }
                } else {
                    String errorMsg = '';
                    for (Database.Error error : results[i].getErrors()) {
                        errorMsg += error.getMessage() + '; ';
                    }
                    failedRecords.add(updatedProcessEntries[i].Id + ': ' + errorMsg);
                }
            }

            // Recalculate location processes if weightage changed
            String recalculationResult = '';
            if (weightageChanged && !affectedScopeEntryIds.isEmpty()) {
                // Fetch affected scope entries for recalculation
                Map<Id, Scope_Entry__c> affectedScopeEntries = new Map<Id, Scope_Entry__c>();
                for (Scope_Entry__c scopeEntry : [
                    SELECT Id, Contract_Value__c
                    FROM Scope_Entry__c
                    WHERE Id IN :affectedScopeEntryIds
                    WITH USER_MODE
                ]) {
                    affectedScopeEntries.put(scopeEntry.Id, scopeEntry);
                }
                
                if (!affectedScopeEntries.isEmpty()) {
                    recalculationResult = recalculateLocationProcessesBulk(affectedScopeEntries);
                }
            }

            if (!failedRecords.isEmpty()) {
                String errorMessage = successCount + ' record(s) updated successfully. Failed records: ' + String.join(failedRecords, ', ');
                if (String.isNotBlank(recalculationResult) && recalculationResult.startsWith('Success')) {
                    errorMessage += '. ' + recalculationResult;
                }
                return 'Partial Success: ' + errorMessage;
            }

            // Build success message
            String successMessage = 'Success: ' + successCount + ' process entry(s) updated successfully';
            if (weightageChanged && String.isNotBlank(recalculationResult)) {
                if (recalculationResult.startsWith('Success')) {
                    successMessage += '. ' + recalculationResult;
                } else {
                    successMessage += '. Recalculation warning: ' + recalculationResult;
                }
            }

            return successMessage;

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'saveProcessEntryInlineEdits','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while saving process entry inline edits.','apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<String> getPicklistValuesForField(String objectApiName, String fieldApiName) {
        List<String> picklistValues = new List<String>();
        
        try {
            Schema.SObjectType objectType = Schema.getGlobalDescribe().get(objectApiName);
            if (objectType == null) {
                return picklistValues;
            }
            
            Schema.DescribeSObjectResult objectDescribe = objectType.getDescribe();
            Schema.DescribeFieldResult fieldDescribe = objectDescribe.fields.getMap().get(fieldApiName)?.getDescribe();
            
            if (fieldDescribe != null && fieldDescribe.getType() == Schema.DisplayType.PICKLIST) {
                List<Schema.PicklistEntry> picklistEntries = fieldDescribe.getPicklistValues();
                for (Schema.PicklistEntry entry : picklistEntries) {
                    if (entry.isActive()) {
                        picklistValues.add(entry.getValue());
                    }
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getPicklistValuesForField','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error fetching picklist values for ' + objectApiName + '.' + fieldApiName,'apiResponse' => null});
        }
        
        return picklistValues;
    }

    /*
    *********************************************************
    @description     : Method is used to delete multiple Scope Entry Processes and recalculate location processes
    @param           : List<Id> processIds - List of Process IDs to delete
    @return          : String - Success or error message with recalculation details
    @author          : Rachit Shah
    @note            : When processes are deleted, related location processes are automatically deleted
                      due to master-detail relationship. This method then redistributes amounts
                      among remaining location processes to maintain proper value distribution.
    ********************************************************
    */
    @AuraEnabled
    public static String deleteSelectedScopeEntryProcesses(List<Id> processIds) {
        try {
            if (processIds == null || processIds.isEmpty()) {
                return 'Process IDs are required';
            }

            // First, get the processes to be deleted along with their scope entries
            List<Scope_Entry_Process__c> processesToDelete = [
                SELECT Id, Name, Scope_Entry__c, Scope_Entry__r.Contract_Value__c
                FROM Scope_Entry_Process__c 
                WHERE Id IN :processIds
                WITH USER_MODE
            ];

            if (processesToDelete.isEmpty()) {
                return 'No processes found for deletion';
            }

            // Collect affected scope entries for recalculation
            Set<Id> affectedScopeEntryIds = new Set<Id>();
            Map<Id, Scope_Entry__c> affectedScopeEntries = new Map<Id, Scope_Entry__c>();
            
            for (Scope_Entry_Process__c process : processesToDelete) {
                affectedScopeEntryIds.add(process.Scope_Entry__c);
                affectedScopeEntries.put(process.Scope_Entry__c, process.Scope_Entry__r);
            }

            // Delete the processes (this will automatically delete related location processes due to master-detail relationship)
            delete as user processesToDelete;

            // Recalculate remaining location processes for affected scope entries
            String recalculationResult = '';
            if (!affectedScopeEntries.isEmpty()) {
                recalculationResult = recalculateLocationProcessesBulk(affectedScopeEntries);
            }

            // Build success message
            String successMessage = 'Success: ' + processesToDelete.size() + ' process(es) deleted';
            if (String.isNotBlank(recalculationResult) && recalculationResult.startsWith('Success')) {
                successMessage += '. ' + recalculationResult;
            } else if (String.isNotBlank(recalculationResult)) {
                successMessage += '. Recalculation warning: ' + recalculationResult;
            }

            return successMessage;

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'deleteSelectedScopeEntryProcesses','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Process deletion failed for IDs: ' + String.join(processIds, ', '),'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

}