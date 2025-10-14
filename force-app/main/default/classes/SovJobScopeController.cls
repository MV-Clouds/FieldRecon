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

                    System.debug('All Scope Entry Processes: ' + allScopeEntryProcesses);


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
    
                    // --- Build setup flag map for each Scope Entry ---
                    // Always allow adding processes regardless of location setup
                    for (SObject entry : rawScopeEntries) {
                        Id scopeEntryId = entry.Id;
                        processSetupFlags.put(scopeEntryId, true); // Always allow process addition
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
            wfrecon__Scope_Entry__c newScopeEntry = new wfrecon__Scope_Entry__c();
            newScopeEntry.Name = (String) scopeEntryData.get('name');
            newScopeEntry.wfrecon__Contract_Value__c = (Decimal) scopeEntryData.get('contractValue');
            newScopeEntry.wfrecon__Description__c = (String) scopeEntryData.get('description');
            newScopeEntry.wfrecon__Job__c = (Id) scopeEntryData.get('jobId');
            newScopeEntry.wfrecon__Type__c = (String) scopeEntryData.get('type'); // Add type field
            newScopeEntry.wfrecon__Scope_Entry_Status__c = 'Draft';
            
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
            
            List<wfrecon__Scope_Entry__c> scopeEntriesToDelete = [
                SELECT Id 
                FROM wfrecon__Scope_Entry__c 
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
            Id scopeEntryId = (Id) processData.get('scopeEntryId');
            
            wfrecon__Scope_Entry_Process__c newProcess = new wfrecon__Scope_Entry_Process__c();
            newProcess.wfrecon__Process_Name__c = (String) processData.get('processName');
            newProcess.wfrecon__Sequence__c = (Decimal) processData.get('sequence'); // For manual processes, use user-provided sequence
            newProcess.wfrecon__Process_Type__c = (String) processData.get('processType');
            
            // Set default weight if not provided for equal distribution
            Decimal weightage = (Decimal) processData.get('weightage');
            newProcess.wfrecon__Weight__c = (weightage != null) ? weightage : 1.0;
            
            newProcess.wfrecon__Measurement_Type__c = (String) processData.get('measurementType');
            newProcess.wfrecon__Scope_Entry__c = scopeEntryId;
            newProcess.wfrecon__Job__c = (Id) processData.get('jobId');
            newProcess.wfrecon__IsManual__c = true; // Mark as manual process
            
            insert as user newProcess;

            Integer relatedLocationsCount = [
                SELECT COUNT()
                FROM wfrecon__Location_Scope_Entry__c
                WHERE wfrecon__Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
            ];

            if (relatedLocationsCount > 0) {
                // Fetch entry for recalculation
                Map<Id, wfrecon__Scope_Entry__c> entryMap = new Map<Id, wfrecon__Scope_Entry__c>(
                    [SELECT Id, wfrecon__Contract_Value__c FROM wfrecon__Scope_Entry__c WHERE Id = :scopeEntryId]
                );
                recalculateLocationProcessesBulk(entryMap);
            }            
            
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
    public static List<wfrecon__Process__c> getProcessLibraryRecords() {
        List<wfrecon__Process__c> processes = new List<wfrecon__Process__c>();
        try {
            processes = [
                SELECT Id, Name, wfrecon__Process_Name__c, wfrecon__Process_Type__c, 
                       wfrecon__Measurement_Type__c, wfrecon__Sequence__c, wfrecon__Weight__c,
                       wfrecon__Process_Description__c
                FROM wfrecon__Process__c
                WITH USER_MODE
                ORDER BY wfrecon__Process_Type__c ASC, wfrecon__Sequence__c ASC NULLS LAST, Name ASC
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
            
            // Get the current maximum sequence number for this scope entry
            List<AggregateResult> maxSequenceResult = [
                SELECT MAX(wfrecon__Sequence__c) maxSeq
                FROM wfrecon__Scope_Entry_Process__c
                WHERE wfrecon__Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
            ];
            
            Decimal currentMaxSequence = 0;
            if (!maxSequenceResult.isEmpty() && maxSequenceResult[0].get('maxSeq') != null) {
                currentMaxSequence = (Decimal) maxSequenceResult[0].get('maxSeq');
            }
            
            // Get Process Library records
            List<wfrecon__Process__c> processLibraryRecords = [
                SELECT Id, Name, wfrecon__Process_Name__c, wfrecon__Process_Type__c, 
                       wfrecon__Measurement_Type__c, wfrecon__Sequence__c, wfrecon__Weight__c   
                FROM wfrecon__Process__c
                WHERE Id IN :selectedProcessIds
                WITH USER_MODE
            ];
            
            // Create Scope Entry Process records with sequential sequence numbers
            List<wfrecon__Scope_Entry_Process__c> scopeEntryProcesses = new List<wfrecon__Scope_Entry_Process__c>();
            Integer sequenceCounter = 1;
            
            for (wfrecon__Process__c process : processLibraryRecords) {
                wfrecon__Scope_Entry_Process__c newScopeProcess = new wfrecon__Scope_Entry_Process__c();
                
                // Required relationship fields
                newScopeProcess.wfrecon__Scope_Entry__c = scopeEntryId;
                newScopeProcess.wfrecon__Process_Library__c = process.Id;
                
                // Copy values from Process Library but assign sequential sequence
                newScopeProcess.wfrecon__Process_Name__c = process.wfrecon__Process_Name__c;
                newScopeProcess.wfrecon__Process_Type__c = process.wfrecon__Process_Type__c;
                newScopeProcess.wfrecon__Measurement_Type__c = process.wfrecon__Measurement_Type__c;
                newScopeProcess.wfrecon__Sequence__c = currentMaxSequence + sequenceCounter; // Sequential assignment
                newScopeProcess.wfrecon__Weight__c = process.wfrecon__Weight__c;
                newScopeProcess.wfrecon__Job__c = jobId; // Associate with Job 
                newScopeProcess.wfrecon__IsManual__c = false; // Mark as library process           
                
                scopeEntryProcesses.add(newScopeProcess);
                sequenceCounter++;
            }
            
            insert as user scopeEntryProcesses;

            Integer relatedLocationsCount = [
                SELECT COUNT()
                FROM wfrecon__Location_Scope_Entry__c
                WHERE wfrecon__Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
            ];

            if (relatedLocationsCount > 0) {
                Map<Id, wfrecon__Scope_Entry__c> entryMap = new Map<Id, wfrecon__Scope_Entry__c>(
                    [SELECT Id, wfrecon__Contract_Value__c FROM wfrecon__Scope_Entry__c WHERE Id = :scopeEntryId]
                );
                recalculateLocationProcessesBulk(entryMap);
            }
                    
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
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getProcessTypes','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while fetching Process Types.','apiResponse' => null});
        }
        return processTypes;
    }

    /*
    *********************************************************
    @description     : Method to get locations related to a scope entry using junction object
    @param           : Id scopeEntryId - Scope Entry Id
    @return          : Map<String, Object> - Map containing all locations from the job and selected location IDs
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getLocationsByScopeEntry(Id scopeEntryId) {
        Map<String, Object> result = new Map<String, Object>();
        List<wfrecon__Location__c> allLocations = new List<wfrecon__Location__c>();
        List<Id> selectedLocationIds = new List<Id>();
        
        try {
            // First get the job ID from the scope entry
            List<wfrecon__Scope_Entry__c> scopeEntries = [
                SELECT Id, wfrecon__Job__c
                FROM wfrecon__Scope_Entry__c
                WHERE Id = :scopeEntryId
                WITH USER_MODE
                LIMIT 1
            ];
            
            if (scopeEntries.isEmpty()) {
                result.put('success', false);
                result.put('message', 'Scope entry not found');
                result.put('allLocations', allLocations);
                result.put('selectedLocationIds', selectedLocationIds);
                return result;
            }
            
            Id jobId = scopeEntries[0].wfrecon__Job__c;
            
            // Get all locations for this job
            allLocations = [
                SELECT Id, Name, wfrecon__Quantity__c, wfrecon__Unit_of_Measure__c, wfrecon__Job__c
                FROM wfrecon__Location__c
                WHERE wfrecon__Job__c = :jobId
                WITH USER_MODE
                ORDER BY Name ASC
            ];
            
            // Get selected location IDs using the junction object
            List<wfrecon__Location_Scope_Entry__c> locationScopeEntries = [
                SELECT wfrecon__Location__c
                FROM wfrecon__Location_Scope_Entry__c
                WHERE wfrecon__Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
            ];
            
            for (wfrecon__Location_Scope_Entry__c lse : locationScopeEntries) {
                if (lse.wfrecon__Location__c != null) {
                    selectedLocationIds.add(lse.wfrecon__Location__c);
                }
            }
            
            result.put('success', true);
            result.put('allLocations', allLocations);
            result.put('selectedLocationIds', selectedLocationIds);
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getLocationsByScopeEntry',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching locations for scope entry: ' + scopeEntryId,
                'apiResponse' => null
            });
            result.put('success', false);
            result.put('message', 'Error: ' + e.getMessage());
            result.put('allLocations', allLocations);
            result.put('selectedLocationIds', selectedLocationIds);
        }
        
        return result;
    }

    /*
    *********************************************************
    @description     : Method to create/update location processes and location scope entries for scope entries with proper recalculation
    @param           : Map<String, Object> locationData - Contains scopeEntryId, location changes, and relationship data
    @return          : String - Success or error message
    @author          : Updated to handle existing location processes and location scope entries with recalculation
    ********************************************************
    */
    @AuraEnabled
    public static String createLocationProcesses(Map<String, Object> locationData) {
        try {
            String scopeEntryId = (String) locationData.get('scopeEntryId');
            if (String.isBlank(scopeEntryId)) return 'Error: Scope Entry ID is required.';

            List<String> addedLocationIds = convertToStringList((List<Object>) locationData.get('addedLocationIds'));
            List<String> removedLocationIds = convertToStringList((List<Object>) locationData.get('removedLocationIds'));
            List<String> selectedLocationIds = convertToStringList((List<Object>) locationData.get('selectedLocationIds'));
            Boolean hasChanges = (Boolean) locationData.get('hasChanges');

            // Fetch Scope Entry
            Scope_Entry__c scopeEntry = [
                SELECT Id, Contract_Value__c
                FROM Scope_Entry__c
                WHERE Id = :scopeEntryId
                WITH USER_MODE
                LIMIT 1
            ];

            if (scopeEntry == null || scopeEntry.Contract_Value__c == null || scopeEntry.Contract_Value__c == 0)
                return 'Error: Invalid or missing Contract Value on Scope Entry.';

            // Fetch all processes for this Scope Entry
            List<wfrecon__Scope_Entry_Process__c> processes = [
                SELECT Id, wfrecon__Weight__c, wfrecon__Sequence__c, wfrecon__Process_Library__c
                FROM wfrecon__Scope_Entry_Process__c
                WHERE wfrecon__Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
                ORDER BY wfrecon__Sequence__c ASC
                
            ];
            if (processes.isEmpty()) return 'Error: No processes found for this Scope Entry.';

            // Calculate total process weight
            Decimal totalWeight = 0;
            for (wfrecon__Scope_Entry_Process__c p : processes)
                totalWeight += (p.wfrecon__Weight__c != null ? p.wfrecon__Weight__c : 0);

            if (totalWeight == 0) return 'Error: Total process weight cannot be zero.';

            // Fetch selected locations for recalculation
            List<wfrecon__Location__c> selectedLocations = new List<wfrecon__Location__c>();
            if (!selectedLocationIds.isEmpty()) {
                selectedLocations = [
                    SELECT Id, Quantity__c
                    FROM wfrecon__Location__c
                    WHERE Id IN :selectedLocationIds
                    WITH USER_MODE
                ];
            }

            Map<Id, Decimal> locationQtyMap = new Map<Id, Decimal>();
            Decimal totalQty = 0;
            for (wfrecon__Location__c loc : selectedLocations) {
                Decimal qty = loc.Quantity__c != null ? loc.Quantity__c : 0;
                locationQtyMap.put(loc.Id, qty);
                totalQty += qty;
            }
            if (totalQty == 0) return 'Error: Total Quantity cannot be zero.';

            // Initialize record lists
            List<wfrecon__Location_Scope_Entry__c> junctionsToCreate = new List<wfrecon__Location_Scope_Entry__c>();
            List<wfrecon__Location_Scope_Entry__c> junctionsToDelete = new List<wfrecon__Location_Scope_Entry__c>();
            List<wfrecon__Location_Process__c> processesToCreate = new List<wfrecon__Location_Process__c>();
            List<wfrecon__Location_Process__c> processesToUpdate = new List<wfrecon__Location_Process__c>();

            // Handle removals
            if (!removedLocationIds.isEmpty()) {
                List<wfrecon__Location_Scope_Entry__c> existingJunctions = [
                    SELECT Id
                    FROM wfrecon__Location_Scope_Entry__c
                    WHERE wfrecon__Scope_Entry__c = :scopeEntryId
                    AND wfrecon__Location__c IN :removedLocationIds
                    WITH USER_MODE
                ];
                if (!existingJunctions.isEmpty()) junctionsToDelete.addAll(existingJunctions);

                List<wfrecon__Location_Process__c> existingProcesses = [
                    SELECT Id
                    FROM wfrecon__Location_Process__c
                    WHERE wfrecon__Scope_Entry_Process__r.wfrecon__Scope_Entry__c = :scopeEntryId
                    AND wfrecon__Location__c IN :removedLocationIds
                    WITH USER_MODE
                ];
                if (!existingProcesses.isEmpty()) delete existingProcesses;

                if (!junctionsToDelete.isEmpty()) delete junctionsToDelete;
            }

            // Handle additions
            if (!addedLocationIds.isEmpty()) {
                for (String locId : addedLocationIds) {
                    junctionsToCreate.add(new wfrecon__Location_Scope_Entry__c(
                        wfrecon__Scope_Entry__c = scopeEntryId,
                        wfrecon__Location__c = locId
                    ));
                }
                if (!junctionsToCreate.isEmpty()) insert junctionsToCreate;

                // Create Location Processes for new locations
                for (String locId : addedLocationIds) {
                    Decimal locQty = locationQtyMap.get(locId);
                    if (locQty == null) continue;
                    Decimal locShare = locQty / totalQty;
                    Decimal locValue = scopeEntry.Contract_Value__c * locShare;

                    // Get the current maximum sequence for this location
                    List<AggregateResult> maxSequenceResult = [
                        SELECT MAX(wfrecon__Sequence__c) maxSeq
                        FROM wfrecon__Location_Process__c
                        WHERE wfrecon__Location__c = :locId
                        WITH USER_MODE
                    ];
                    
                    Integer startingSequence = 1;
                    if (!maxSequenceResult.isEmpty() && maxSequenceResult[0].get('maxSeq') != null) {
                        startingSequence = ((Decimal) maxSequenceResult[0].get('maxSeq')).intValue() + 1;
                    }

                    Integer sequenceCounter = startingSequence;
                    for (wfrecon__Scope_Entry_Process__c p : processes) {
                        Decimal weightShare = (p.wfrecon__Weight__c != null ? p.wfrecon__Weight__c : 0) / totalWeight;
                        processesToCreate.add(new wfrecon__Location_Process__c(
                            wfrecon__Location__c = locId,
                            wfrecon__Scope_Entry_Process__c = p.Id,
                            wfrecon__Process_Library__c = p.wfrecon__Process_Library__c,
                            wfrecon__Sequence__c = sequenceCounter,
                            wfrecon__Contract_Price__c = locValue * weightShare
                        ));
                        sequenceCounter++;
                    }
                }
                if (!processesToCreate.isEmpty()) insert processesToCreate;
            }

            // Handle updates (recalculate existing ones)
            if (hasChanges && !selectedLocationIds.isEmpty()) {
                List<wfrecon__Location_Process__c> existingToUpdate = [
                    SELECT Id, wfrecon__Location__c, wfrecon__Scope_Entry_Process__c
                    FROM wfrecon__Location_Process__c
                    WHERE wfrecon__Scope_Entry_Process__r.wfrecon__Scope_Entry__c = :scopeEntryId
                    AND wfrecon__Location__c IN :selectedLocationIds
                    WITH USER_MODE
                ];

                Map<Id, Decimal> weightMap = new Map<Id, Decimal>();
                for (wfrecon__Scope_Entry_Process__c p : processes)
                    weightMap.put(p.Id, p.wfrecon__Weight__c != null ? p.wfrecon__Weight__c : 0);

                for (wfrecon__Location_Process__c lp : existingToUpdate) {
                    Decimal locQty = locationQtyMap.get(lp.wfrecon__Location__c);
                    if (locQty == null) continue;
                    Decimal locShare = locQty / totalQty;
                    Decimal weightShare = (weightMap.get(lp.wfrecon__Scope_Entry_Process__c) / totalWeight);
                    lp.wfrecon__Contract_Price__c = scopeEntry.Contract_Value__c * locShare * weightShare;
                    processesToUpdate.add(lp);
                }

                if (!processesToUpdate.isEmpty()) update processesToUpdate;
            }

            return 'Success: ' +
                (junctionsToCreate.isEmpty() ? '' : junctionsToCreate.size() + ' new location(s) added, ') +
                (junctionsToDelete.isEmpty() ? '' : junctionsToDelete.size() + ' removed, ') +
                (processesToCreate.isEmpty() ? '' : processesToCreate.size() + ' processes created, ') +
                (processesToUpdate.isEmpty() ? '' : processesToUpdate.size() + ' processes updated.');

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'createLocationProcesses',
                'isApiException' => false,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while creating/updating location processes.'
            });
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
            List<wfrecon__Scope_Entry__c> updatedScopeEntries =
                (List<wfrecon__Scope_Entry__c>) JSON.deserialize(updatedScopeEntriesJson, List<wfrecon__Scope_Entry__c>.class);
    
            if (updatedScopeEntries == null || updatedScopeEntries.isEmpty()) {
                return 'Error: No scope entry records provided for update.';
            }
            
            // Track contract value changes and get original data for approval date logic
            Set<Id> scopeEntriesWithContractValueChanges = new Set<Id>();
            Map<Id, Decimal> originalContractValues = new Map<Id, Decimal>();
            Map<Id, String> originalStatuses = new Map<Id, String>();
            List<Id> scopeEntryIds = new List<Id>();
    
            for (wfrecon__Scope_Entry__c entry : updatedScopeEntries) {
                scopeEntryIds.add(entry.Id);
            }
    
            // Fetch original contract values and statuses
            for (wfrecon__Scope_Entry__c original : [
                SELECT Id, wfrecon__Contract_Value__c, wfrecon__Scope_Entry_Status__c
                FROM wfrecon__Scope_Entry__c
                WHERE Id IN :scopeEntryIds
                WITH USER_MODE
            ]) {
                originalContractValues.put(original.Id, original.wfrecon__Contract_Value__c);
                originalStatuses.put(original.Id, original.wfrecon__Scope_Entry_Status__c);
            }
            
            // Set approval date for entries being approved (status changing from non-approved to approved)
            Date currentDate = Date.today();
            for (wfrecon__Scope_Entry__c entry : updatedScopeEntries) {
                String originalStatus = originalStatuses.get(entry.Id);
                if (entry.wfrecon__Scope_Entry_Status__c == 'Approved' && originalStatus != 'Approved') {
                    // Set approval date - use wfrecon namespace prefix
                    entry.put('wfrecon__Approved_Date__c', currentDate);
                }
            }
    
            // Identify records where Contract_Value__c changed
            for (wfrecon__Scope_Entry__c updatedEntry : updatedScopeEntries) {
                Decimal oldVal = originalContractValues.get(updatedEntry.Id);
                Decimal newVal = updatedEntry.wfrecon__Contract_Value__c;
    
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
                Map<Id, wfrecon__Scope_Entry__c> changedEntries = new Map<Id, wfrecon__Scope_Entry__c>();
                for (wfrecon__Scope_Entry__c se : updatedScopeEntries) {
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
    @description : Bulk recalculation of location processes for Scope Entries
                Automatically handles creation of missing Location Processes
    @param       : Map<Id, wfrecon__Scope_Entry__c> scopeEntries
    @return      : String - Summary message
    *********************************************************
    */
    public static String recalculateLocationProcessesBulk(Map<Id, wfrecon__Scope_Entry__c> scopeEntries) {
        try {
            if (scopeEntries == null || scopeEntries.isEmpty()) {
                return 'No scope entries provided for recalculation.';
            }

            Set<Id> scopeEntryIds = scopeEntries.keySet();

            // Fetch all Scope Entry Processes
            Map<Id, List<wfrecon__Scope_Entry_Process__c>> entryToProcesses = new Map<Id, List<wfrecon__Scope_Entry_Process__c>>();
            for (wfrecon__Scope_Entry_Process__c proc : [
                SELECT Id, wfrecon__Scope_Entry__c, wfrecon__Weight__c,
                    wfrecon__Sequence__c, wfrecon__Process_Library__c
                FROM wfrecon__Scope_Entry_Process__c
                WHERE wfrecon__Scope_Entry__c IN :scopeEntryIds
                WITH USER_MODE
            ]) {
                if (!entryToProcesses.containsKey(proc.wfrecon__Scope_Entry__c)) {
                    entryToProcesses.put(proc.wfrecon__Scope_Entry__c, new List<wfrecon__Scope_Entry_Process__c>());
                }
                entryToProcesses.get(proc.wfrecon__Scope_Entry__c).add(proc);
            }

            // Fetch all Location junctions
            Map<Id, List<wfrecon__Location_Scope_Entry__c>> entryToJunctions = new Map<Id, List<wfrecon__Location_Scope_Entry__c>>();
            for (wfrecon__Location_Scope_Entry__c junc : [
                SELECT Id, wfrecon__Scope_Entry__c, wfrecon__Location__c,
                    wfrecon__Location__r.Quantity__c
                FROM wfrecon__Location_Scope_Entry__c
                WHERE wfrecon__Scope_Entry__c IN :scopeEntryIds
                WITH USER_MODE
            ]) {
                if (!entryToJunctions.containsKey(junc.wfrecon__Scope_Entry__c)) {
                    entryToJunctions.put(junc.wfrecon__Scope_Entry__c, new List<wfrecon__Location_Scope_Entry__c>());
                }
                entryToJunctions.get(junc.wfrecon__Scope_Entry__c).add(junc);
            }

            // Fetch existing Location Processes
            Map<Id, List<wfrecon__Location_Process__c>> entryToLocProcesses = new Map<Id, List<wfrecon__Location_Process__c>>();
            for (wfrecon__Location_Process__c lp : [
                SELECT Id, wfrecon__Scope_Entry_Process__c, 
                    wfrecon__Scope_Entry_Process__r.wfrecon__Scope_Entry__c, 
                    wfrecon__Location__c
                FROM wfrecon__Location_Process__c
                WHERE wfrecon__Scope_Entry_Process__r.wfrecon__Scope_Entry__c IN :scopeEntryIds
                WITH USER_MODE
            ]) {
                Id entryId = lp.wfrecon__Scope_Entry_Process__r.wfrecon__Scope_Entry__c;
                if (!entryToLocProcesses.containsKey(entryId)) {
                    entryToLocProcesses.put(entryId, new List<wfrecon__Location_Process__c>());
                }
                entryToLocProcesses.get(entryId).add(lp);
            }

            // Prepare for insert/update
            List<wfrecon__Location_Process__c> toInsert = new List<wfrecon__Location_Process__c>();
            List<wfrecon__Location_Process__c> toUpdate = new List<wfrecon__Location_Process__c>();

            for (Id entryId : scopeEntryIds) {
                Scope_Entry__c entry = scopeEntries.get(entryId);
                List<wfrecon__Scope_Entry_Process__c> processes = entryToProcesses.get(entryId);
                List<wfrecon__Location_Scope_Entry__c> junctions = entryToJunctions.get(entryId);
                List<wfrecon__Location_Process__c> locProcesses = entryToLocProcesses.get(entryId);

                if (entry == null || processes == null || junctions == null) continue;
                if (entry.Contract_Value__c == null || entry.Contract_Value__c == 0) continue;

                // Calculate total process weight
                Decimal totalWeight = 0;
                Map<Id, Decimal> weightMap = new Map<Id, Decimal>();
                for (wfrecon__Scope_Entry_Process__c p : processes) {
                    Decimal w = p.wfrecon__Weight__c != null ? p.wfrecon__Weight__c : 0;
                    totalWeight += w;
                    weightMap.put(p.Id, w);
                }
                if (totalWeight == 0) continue;

                // Calculate total location quantity
                Decimal totalQty = 0;
                Map<Id, Decimal> qtyMap = new Map<Id, Decimal>();
                for (wfrecon__Location_Scope_Entry__c j : junctions) {
                    Decimal q = j.wfrecon__Location__r.Quantity__c != null ? j.wfrecon__Location__r.Quantity__c : 0;
                    totalQty += q;
                    qtyMap.put(j.wfrecon__Location__c, q);
                }
                if (totalQty == 0) continue;

                // Build existing location-process map for this entry
                Map<String, wfrecon__Location_Process__c> existingMap = new Map<String, wfrecon__Location_Process__c>();
                Map<Id, Integer> locationMaxSequence = new Map<Id, Integer>();
                
                if (locProcesses != null) {
                    for (wfrecon__Location_Process__c lp : locProcesses) {
                        String key = lp.wfrecon__Location__c + '_' + lp.wfrecon__Scope_Entry_Process__c;
                        existingMap.put(key, lp);
                        
                        // Track the maximum sequence number for each location
                        Integer currentSeq = lp.wfrecon__Sequence__c != null ? lp.wfrecon__Sequence__c.intValue() : 0;
                        Integer maxSeq = locationMaxSequence.get(lp.wfrecon__Location__c);
                        if (maxSeq == null || currentSeq > maxSeq) {
                            locationMaxSequence.put(lp.wfrecon__Location__c, currentSeq);
                        }
                    }
                }

                // Create or update each location-process combination
                Map<Id, Integer> locationSequenceCounters = new Map<Id, Integer>();
                
                for (wfrecon__Scope_Entry_Process__c proc : processes) {
                    Decimal weight = weightMap.get(proc.Id);
                    if (weight == null || weight == 0) continue;

                    for (wfrecon__Location_Scope_Entry__c junc : junctions) {
                        Decimal locQty = qtyMap.get(junc.wfrecon__Location__c);
                        if (locQty == null || locQty == 0) continue;

                        Decimal locShare = locQty / totalQty;
                        Decimal weightShare = weight / totalWeight;
                        Decimal newPrice = entry.Contract_Value__c * locShare * weightShare;

                        String key = junc.wfrecon__Location__c + '_' + proc.Id;
                        if (existingMap.containsKey(key)) {
                            // Update existing - preserve existing sequence, only update price
                            toUpdate.add(new wfrecon__Location_Process__c(
                                Id = existingMap.get(key).Id,
                                wfrecon__Contract_Price__c = newPrice
                                // Note: Deliberately NOT updating sequence to preserve existing sequence
                            ));
                        } else {
                            // Create missing Location Process with next available sequence for this location
                            if (!locationSequenceCounters.containsKey(junc.wfrecon__Location__c)) {
                                // Initialize counter with max existing sequence + 1
                                Integer maxSeq = locationMaxSequence.get(junc.wfrecon__Location__c);
                                locationSequenceCounters.put(junc.wfrecon__Location__c, 
                                    maxSeq != null ? maxSeq + 1 : 1);
                            }
                            
                            toInsert.add(new wfrecon__Location_Process__c(
                                wfrecon__Location__c = junc.wfrecon__Location__c,
                                wfrecon__Scope_Entry_Process__c = proc.Id,
                                wfrecon__Process_Library__c = proc.wfrecon__Process_Library__c,
                                wfrecon__Sequence__c = locationSequenceCounters.get(junc.wfrecon__Location__c),
                                wfrecon__Contract_Price__c = newPrice
                            ));
                            // Increment sequence counter for this location
                            locationSequenceCounters.put(junc.wfrecon__Location__c, 
                                locationSequenceCounters.get(junc.wfrecon__Location__c) + 1);
                        }
                    }
                }
            }

            // DML operations
            if (!toInsert.isEmpty()) insert toInsert;
            if (!toUpdate.isEmpty()) update toUpdate;

            return 'Success: ' + toInsert.size() + ' new and ' + toUpdate.size() +
                ' existing location process records recalculated for ' + scopeEntries.size() + ' scope entries.';

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'recalculateLocationProcessesBulk',
                'isApiException' => false,
                'exceptionObj' => e,
                'moreDetails' => 'Error during recalculation.'
            });
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