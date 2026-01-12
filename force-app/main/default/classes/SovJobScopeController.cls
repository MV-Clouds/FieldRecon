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
        Map<Id, List<Scope_Entry_Process__c>> scopeEntryProcessMap = new Map<Id, List<Scope_Entry_Process__c>>();

        try {
            String objectName = 'wfrecon__Scope_Entry__c';
            String allScopeEntryFields = getAllFields(objectName);
            
            if (String.isNotBlank(allScopeEntryFields)) {
                // ✅ Include only the one Job field needed
                String query = 'SELECT ' + allScopeEntryFields +
                            ', wfrecon__Job__r.wfrecon__Total_Contract_Price__c' +
                            ' FROM ' + objectName +
                            ' WHERE wfrecon__Job__c = :jobId' +
                            ' ORDER BY CreatedDate DESC';

                List<SObject> rawScopeEntries = Database.query(String.escapeSingleQuotes(query), AccessLevel.USER_MODE);
                scopeEntries.addAll(rawScopeEntries);

                if (!rawScopeEntries.isEmpty()) {
                    // Collect all Scope Entry IDs
                    Set<Id> scopeEntryIds = new Set<Id>();
                    for (SObject entry : rawScopeEntries) {
                        scopeEntryIds.add(entry.Id);
                    }

                    // Fetch location counts for each scope entry
                    Map<Id, Integer> scopeEntryLocationCounts = new Map<Id, Integer>();
                    List<AggregateResult> locationCounts = [
                        SELECT Scope_Entry__c, COUNT(Id) locationCount
                        FROM Location_Scope_Entry__c
                        WHERE Scope_Entry__c IN :scopeEntryIds
                        WITH USER_MODE
                        GROUP BY Scope_Entry__c
                    ];
                    
                    for (AggregateResult ar : locationCounts) {
                        Id scopeEntryId = (Id) ar.get('wfrecon__Scope_Entry__c');
                        Integer count = (Integer) ar.get('locationCount');
                        scopeEntryLocationCounts.put(scopeEntryId, count);
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

                    // Group processes by scope entry
                    for (Scope_Entry_Process__c process : allScopeEntryProcesses) {
                        Id scopeEntryId = process.Scope_Entry__c;
                        if (!scopeEntryProcessMap.containsKey(scopeEntryId)) {
                            scopeEntryProcessMap.put(scopeEntryId, new List<Scope_Entry_Process__c>());
                        }
                        scopeEntryProcessMap.get(scopeEntryId).add(process);
                    }

                    result.put('scopeEntryLocationCounts', scopeEntryLocationCounts);
                }
            }

            result.put('scopeEntries', scopeEntries);
            result.put('scopeEntryProcessMap', scopeEntryProcessMap);
            result.put('scopeEntryLocationCounts', result.containsKey('scopeEntryLocationCounts') ? result.get('scopeEntryLocationCounts') : new Map<Id, Integer>());
            result.put('success', true);

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getScopeEntries', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching Scope Entries dynamically (bulk-safe version).','apiResponse' => null});

            result.put('scopeEntries', new List<SObject>());
            result.put('scopeEntryProcessMap', new Map<Id, List<Scope_Entry_Process__c>>());
            result.put('scopeEntryLocationCounts', new Map<Id, Integer>());
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
    @note            : Not cacheable to ensure fresh metadata retrieval
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getScopeEntryConfiguration() {
        Map<String, Object> configData = new Map<String, Object>();
        
        try {
            // Query all records and use the first one (metadata should have only one record ideally)
            List<ScopeEntryConfigration__mdt> configs = [
                SELECT FieldValue__c, PageSize__c, DeveloperName, MasterLabel
                FROM ScopeEntryConfigration__mdt 
                WITH USER_MODE 
                ORDER BY DeveloperName
                LIMIT 1
            ];

            if (!configs.isEmpty()) {
                ScopeEntryConfigration__mdt config = configs[0];
                configData.put('fieldsData', config.FieldValue__c);
                configData.put('pageSize', config.PageSize__c);
                configData.put('timestamp', String.valueOf(System.now().getTime()));
                
                System.debug('Configuration fetched: ' + config.DeveloperName);
                System.debug('Fields Data: ' + config.FieldValue__c);
            }
            else{
                configData.put('fieldsData', '');
                configData.put('pageSize', 10);
                configData.put('timestamp', String.valueOf(System.now().getTime()));
                System.debug('No configuration found, using defaults');
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
            newScopeEntry.Type__c = (String) scopeEntryData.get('type'); 
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
            Id scopeEntryId = (Id) processData.get('scopeEntryId');
            
            Scope_Entry_Process__c newProcess = new Scope_Entry_Process__c();
            newProcess.Process_Name__c = (String) processData.get('processName');
            newProcess.Sequence__c = (Decimal) processData.get('sequence'); // For manual processes, use user-provided sequence
            newProcess.Process_Type__c = (String) processData.get('processType');
            
            // Set default weight if not provided for equal distribution
            Decimal weightage = (Decimal) processData.get('weightage');
            newProcess.Weight__c = (weightage != null) ? weightage : 1.0;
            
            newProcess.Measurement_Type__c = (String) processData.get('measurementType');
            newProcess.Scope_Entry__c = scopeEntryId;
            newProcess.Job__c = (Id) processData.get('jobId');
            newProcess.IsManual__c = true; // Mark as manual process
            
            insert as user newProcess;

            Integer relatedLocationsCount = [
                SELECT COUNT()
                FROM Location_Scope_Entry__c
                WHERE Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
            ];

            if (relatedLocationsCount > 0) {
                // Fetch entry for recalculation
                Map<Id, Scope_Entry__c> entryMap = new Map<Id, Scope_Entry__c>(
                    [SELECT Id, Contract_Value__c FROM Scope_Entry__c WHERE Id = :scopeEntryId WITH USER_MODE]
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
            
            // Get the current maximum sequence number for this scope entry
            List<AggregateResult> maxSequenceResult = [
                SELECT MAX(Sequence__c) maxSeq
                FROM Scope_Entry_Process__c
                WHERE Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
            ];
            
            Decimal currentMaxSequence = 0;
            if (!maxSequenceResult.isEmpty() && maxSequenceResult[0].get('maxSeq') != null) {
                currentMaxSequence = (Decimal) maxSequenceResult[0].get('maxSeq');
            }
            
            // Get Process Library records
            List<Process__c> processLibraryRecords = [
                SELECT Id, Name, Process_Name__c, Process_Type__c, 
                       Measurement_Type__c, Sequence__c, Weight__c   
                FROM Process__c
                WHERE Id IN :selectedProcessIds
                WITH USER_MODE
            ];
            
            // Create Scope Entry Process records with sequential sequence numbers
            List<Scope_Entry_Process__c> scopeEntryProcesses = new List<Scope_Entry_Process__c>();
            Integer sequenceCounter = 1;
            
            for (Process__c process : processLibraryRecords) {
                Scope_Entry_Process__c newScopeProcess = new Scope_Entry_Process__c();
                
                // Required relationship fields
                newScopeProcess.Scope_Entry__c = scopeEntryId;
                newScopeProcess.Process_Library__c = process.Id;
                
                // Copy values from Process Library but assign sequential sequence
                newScopeProcess.Process_Name__c = process.Process_Name__c;
                newScopeProcess.Process_Type__c = process.Process_Type__c;
                newScopeProcess.Measurement_Type__c = process.Measurement_Type__c;
                newScopeProcess.Sequence__c = currentMaxSequence + sequenceCounter; // Sequential assignment
                newScopeProcess.Weight__c = process.Weight__c;
                newScopeProcess.Job__c = jobId; // Associate with Job 
                newScopeProcess.IsManual__c = false; // Mark as library process           
                
                scopeEntryProcesses.add(newScopeProcess);
                sequenceCounter++;
            }
            
            insert as user scopeEntryProcesses;

            Integer relatedLocationsCount = [
                SELECT COUNT()
                FROM Location_Scope_Entry__c
                WHERE Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
            ];

            if (relatedLocationsCount > 0) {
                Map<Id, Scope_Entry__c> entryMap = new Map<Id, Scope_Entry__c>(
                    [SELECT Id, Contract_Value__c FROM Scope_Entry__c WHERE Id = :scopeEntryId WITH USER_MODE]
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
    @description     : Method to get locations related to a scope entry using junction object
    @param           : Id scopeEntryId - Scope Entry Id
    @return          : Map<String, Object> - Map containing all locations from the job and selected location IDs
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getLocationsByScopeEntry(Id scopeEntryId) {
        Map<String, Object> result = new Map<String, Object>();
        List<Location__c> allLocations = new List<Location__c>();
        List<Id> selectedLocationIds = new List<Id>();
        
        try {
            // First get the job ID from the scope entry
            List<Scope_Entry__c> scopeEntries = [
                SELECT Id, Job__c
                FROM Scope_Entry__c
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
            
            Id jobId = scopeEntries[0].Job__c;
            
            // Get all locations for this job
            allLocations = [
                SELECT Id, Name, Quantity__c, Unit_of_Measure__c, Job__c
                FROM Location__c
                WHERE Job__c = :jobId
                WITH USER_MODE
                ORDER BY Name ASC
            ];
            
            // Get selected location IDs using the junction object
            List<Location_Scope_Entry__c> locationScopeEntries = [
                SELECT Location__c
                FROM Location_Scope_Entry__c
                WHERE Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
            ];
            
            for (Location_Scope_Entry__c lse : locationScopeEntries) {
                if (lse.Location__c != null) {
                    selectedLocationIds.add(lse.Location__c);
                }
            }
            
            result.put('success', true);
            result.put('allLocations', allLocations);
            result.put('selectedLocationIds', selectedLocationIds);
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getLocationsByScopeEntry','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while fetching locations for scope entry: ' + scopeEntryId,'apiResponse' => null});
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
            if (String.isBlank(scopeEntryId)) {
                return 'Error: Scope Entry ID is required.';
            }

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

            if (scopeEntry == null || scopeEntry.Contract_Value__c == null || scopeEntry.Contract_Value__c == 0){
                return 'Error: Invalid or missing Contract Value on Scope Entry.';
            }

            // Fetch all processes for this Scope Entry
            List<Scope_Entry_Process__c> processes = [
                SELECT Id, Weight__c, Sequence__c, Process_Library__c
                FROM Scope_Entry_Process__c
                WHERE Scope_Entry__c = :scopeEntryId
                WITH USER_MODE
                ORDER BY Sequence__c ASC
                
            ];
            if (processes.isEmpty()){
                return 'Error: No processes found for this Scope Entry.';
            }

            // Calculate total process weight
            Decimal totalWeight = 0;
            for (Scope_Entry_Process__c p : processes){
                totalWeight += (p.Weight__c != null ? p.Weight__c : 0);
            }

            if (totalWeight == 0){
                return 'Error: Total process weight cannot be zero.';
            }

            // Fetch selected locations for recalculation
            List<Location__c> selectedLocations = new List<Location__c>();
            if (!selectedLocationIds.isEmpty()) {
                selectedLocations = [
                    SELECT Id, Quantity__c
                    FROM Location__c
                    WHERE Id IN :selectedLocationIds
                    WITH USER_MODE
                ];
            }

            Map<Id, Decimal> locationQtyMap = new Map<Id, Decimal>();
            Decimal totalQty = 0;
            for (Location__c loc : selectedLocations) {
                Decimal qty = loc.Quantity__c != null ? loc.Quantity__c : 0;
                locationQtyMap.put(loc.Id, qty);
                totalQty += qty;
            }
            if (totalQty == 0){
              return 'Error: Total Quantity cannot be zero.';  
            } 

            // Initialize record lists
            List<Location_Scope_Entry__c> junctionsToCreate = new List<Location_Scope_Entry__c>();
            List<Location_Scope_Entry__c> junctionsToDelete = new List<Location_Scope_Entry__c>();
            List<Location_Process__c> processesToCreate = new List<Location_Process__c>();
            List<Location_Process__c> processesToUpdate = new List<Location_Process__c>();

            // Handle removals
            if (!removedLocationIds.isEmpty()) {
                List<Location_Scope_Entry__c> existingJunctions = [
                    SELECT Id
                    FROM Location_Scope_Entry__c
                    WHERE Scope_Entry__c = :scopeEntryId
                    AND Location__c IN :removedLocationIds
                    WITH USER_MODE
                ];
                if (!existingJunctions.isEmpty()){
                    junctionsToDelete.addAll(existingJunctions);
                }

                List<Location_Process__c> existingProcesses = [
                    SELECT Id
                    FROM Location_Process__c
                    WHERE Scope_Entry_Process__r.Scope_Entry__c = :scopeEntryId
                    AND Location__c IN :removedLocationIds
                    WITH USER_MODE
                ];
                if (!existingProcesses.isEmpty()){
                    delete as user existingProcesses;
                }

                if (!junctionsToDelete.isEmpty()) {
                    delete as user junctionsToDelete;
                }
            }

            // Handle additions
            if (!addedLocationIds.isEmpty()) {
                for (String locId : addedLocationIds) {
                    junctionsToCreate.add(new Location_Scope_Entry__c(
                        Scope_Entry__c = scopeEntryId,
                        Location__c = locId
                    ));
                }
                if (!junctionsToCreate.isEmpty()){
                    insert as user junctionsToCreate;
                }

                // Bulk query: Get the current maximum sequence for all new locations at once
                List<AggregateResult> maxSequenceResults = [
                    SELECT Location__c, MAX(Sequence__c) maxSeq
                    FROM Location_Process__c
                    WHERE Location__c IN :addedLocationIds
                    WITH USER_MODE
                    GROUP BY Location__c
                ];
                
                // Build a map of Location ID to max sequence
                Map<String, Integer> locationMaxSequenceMap = new Map<String, Integer>();
                for (AggregateResult ar : maxSequenceResults) {
                    String locationId = (String) ar.get('wfrecon__Location__c');
                    Decimal maxSeq = (Decimal) ar.get('maxSeq');
                    if (maxSeq != null) {
                        locationMaxSequenceMap.put(locationId, maxSeq.intValue());
                    }
                }

                // Create Location Processes for new locations
                for (String locId : addedLocationIds) {
                    Decimal locQty = locationQtyMap.get(locId);
                    if (locQty == null) {
                        continue;
                    }
                    Decimal locShare = locQty / totalQty;
                    Decimal locValue = scopeEntry.Contract_Value__c * locShare;

                    // Get the starting sequence from the map (defaults to 1 if not found)
                    Integer startingSequence = locationMaxSequenceMap.containsKey(locId) 
                        ? locationMaxSequenceMap.get(locId) + 1 
                        : 1;

                    Integer sequenceCounter = startingSequence;
                    for (Scope_Entry_Process__c p : processes) {
                        Decimal weightShare = (p.Weight__c != null ? p.Weight__c : 0) / totalWeight;
                        processesToCreate.add(new Location_Process__c(
                            Location__c = locId,
                            Scope_Entry_Process__c = p.Id,
                            Process_Library__c = p.Process_Library__c,
                            Sequence__c = sequenceCounter,
                            Contract_Price__c = locValue * weightShare
                        ));
                        sequenceCounter++;
                    }
                }
                if (!processesToCreate.isEmpty()){
                    insert as user processesToCreate;
                }
            }

            // Handle updates (recalculate existing ones)
            if (hasChanges && !selectedLocationIds.isEmpty()) {
                List<Location_Process__c> existingToUpdate = [
                    SELECT Id, Location__c, Scope_Entry_Process__c , Scope_Entry_Process__r.Scope_Entry__c
                    FROM Location_Process__c
                    WHERE Scope_Entry_Process__r.Scope_Entry__c = :scopeEntryId
                    AND Location__c IN :selectedLocationIds
                    WITH USER_MODE
                ];

                Map<Id, Decimal> weightMap = new Map<Id, Decimal>();
                for (Scope_Entry_Process__c p : processes){
                    weightMap.put(p.Id, p.Weight__c != null ? p.Weight__c : 0);
                }

                for (Location_Process__c lp : existingToUpdate) {
                    Decimal locQty = locationQtyMap.get(lp.Location__c);
                    if (locQty == null){
                        continue;
                    }
                    Decimal locShare = locQty / totalQty;
                    Decimal weightShare = (weightMap.get(lp.Scope_Entry_Process__c) / totalWeight);
                    lp.Contract_Price__c = scopeEntry.Contract_Value__c * locShare * weightShare;
                    processesToUpdate.add(lp);
                }

                if (!processesToUpdate.isEmpty() &&
                Schema.sObjectType.Location_Process__c.fields.Location__c.isAccessible() &&
                Schema.sObjectType.Location_Process__c.fields.Location__c.isUpdateable() &&
                Schema.sObjectType.Location_Process__c.fields.Scope_Entry_Process__c.isAccessible() &&
                Schema.sObjectType.Location_Process__c.fields.Scope_Entry_Process__c.isUpdateable() &&
                Schema.sObjectType.Location_Process__c.fields.Contract_Price__c.isAccessible() &&
                Schema.sObjectType.Location_Process__c.fields.Contract_Price__c.isUpdateable() &&
                Schema.sObjectType.Scope_Entry_Process__c.fields.Scope_Entry__c.isAccessible() &&
                Schema.sObjectType.Scope_Entry_Process__c.fields.Scope_Entry__c.isUpdateable() &&
                Schema.sObjectType.Scope_Entry_Process__c.fields.Weight__c.isAccessible() &&
                Schema.sObjectType.Scope_Entry_Process__c.fields.Weight__c.isUpdateable())
                {
                    update processesToUpdate;
                }
            }

            return 'Success: ' +
                (junctionsToCreate.isEmpty() ? '' : junctionsToCreate.size() + ' new location(s) added, ') +
                (junctionsToDelete.isEmpty() ? '' : junctionsToDelete.size() + ' removed, ') +
                (processesToCreate.isEmpty() ? '' : processesToCreate.size() + ' processes created, ') +
                (processesToUpdate.isEmpty() ? '' : processesToUpdate.size() + ' processes updated.');

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'createLocationProcesses','isApiException' => false,'exceptionObj' => e,'moreDetails' => 'Error occurred while creating/updating location processes.'});
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
            
            // Track contract value changes and get original data for approval date logic
            Set<Id> scopeEntriesWithContractValueChanges = new Set<Id>();
            Map<Id, Decimal> originalContractValues = new Map<Id, Decimal>();
            Map<Id, String> originalStatuses = new Map<Id, String>();
            List<Id> scopeEntryIds = new List<Id>();
    
            for (Scope_Entry__c entry : updatedScopeEntries) {
                scopeEntryIds.add(entry.Id);
            }
    
            // Fetch original contract values and statuses
            for (Scope_Entry__c original : [
                SELECT Id, Contract_Value__c, Scope_Entry_Status__c
                FROM Scope_Entry__c
                WHERE Id IN :scopeEntryIds
                WITH USER_MODE
            ]) {
                originalContractValues.put(original.Id, original.Contract_Value__c);
                originalStatuses.put(original.Id, original.Scope_Entry_Status__c);
            }
            
            // Set approval date for entries being approved (status changing from non-approved to approved)
            Date currentDate = Date.today();
            for (Scope_Entry__c entry : updatedScopeEntries) {
                String originalStatus = originalStatuses.get(entry.Id);
                if (entry.Scope_Entry_Status__c == 'Approved' && originalStatus != 'Approved') {
                    entry.put('wfrecon__Approved_Date__c', currentDate);
                }
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
                responseMessage = successCount + ' record(s) updated successfully. Failed records: ' + String.join(failedRecords, ', ');
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
    @param       : Map<Id, Scope_Entry__c> scopeEntries
    @return      : String - Summary message
    *********************************************************
    */
    public static String recalculateLocationProcessesBulk(Map<Id, Scope_Entry__c> scopeEntries) {
        try {
            if (scopeEntries == null || scopeEntries.isEmpty()) {
                return 'No scope entries provided for recalculation.';
            }

            Set<Id> scopeEntryIds = scopeEntries.keySet();

            // Fetch all Scope Entry Processes
            Map<Id, List<Scope_Entry_Process__c>> entryToProcesses = new Map<Id, List<Scope_Entry_Process__c>>();
            for (Scope_Entry_Process__c proc : [
                SELECT Id, Scope_Entry__c, Weight__c,
                    Sequence__c, Process_Library__c
                FROM Scope_Entry_Process__c
                WHERE Scope_Entry__c IN :scopeEntryIds
                WITH USER_MODE
            ]) {
                if (!entryToProcesses.containsKey(proc.Scope_Entry__c)) {
                    entryToProcesses.put(proc.Scope_Entry__c, new List<Scope_Entry_Process__c>());
                }
                entryToProcesses.get(proc.Scope_Entry__c).add(proc);
            }

            // Fetch all Location junctions
            Map<Id, List<Location_Scope_Entry__c>> entryToJunctions = new Map<Id, List<Location_Scope_Entry__c>>();
            for (Location_Scope_Entry__c junc : [
                SELECT Id, Scope_Entry__c, Location__c,
                    Location__r.Quantity__c
                FROM Location_Scope_Entry__c
                WHERE Scope_Entry__c IN :scopeEntryIds
                WITH USER_MODE
            ]) {
                if (!entryToJunctions.containsKey(junc.Scope_Entry__c)) {
                    entryToJunctions.put(junc.Scope_Entry__c, new List<Location_Scope_Entry__c>());
                }
                entryToJunctions.get(junc.Scope_Entry__c).add(junc);
            }

            // Fetch existing Location Processes
            Map<Id, List<Location_Process__c>> entryToLocProcesses = new Map<Id, List<Location_Process__c>>();
            for (Location_Process__c lp : [
                SELECT Id, Scope_Entry_Process__c, Sequence__c, 
                    Scope_Entry_Process__r.Scope_Entry__c, 
                    Location__c
                FROM Location_Process__c
                WHERE Scope_Entry_Process__r.Scope_Entry__c IN :scopeEntryIds
                WITH USER_MODE
            ]) {
                Id entryId = lp.Scope_Entry_Process__r.Scope_Entry__c;
                if (!entryToLocProcesses.containsKey(entryId)) {
                    entryToLocProcesses.put(entryId, new List<Location_Process__c>());
                }
                entryToLocProcesses.get(entryId).add(lp);
            }

            // Prepare for insert/update
            List<Location_Process__c> toInsert = new List<Location_Process__c>();
            List<Location_Process__c> toUpdate = new List<Location_Process__c>();

            for (Id entryId : scopeEntryIds) {
                Scope_Entry__c entry = scopeEntries.get(entryId);
                List<Scope_Entry_Process__c> processes = entryToProcesses.get(entryId);
                List<Location_Scope_Entry__c> junctions = entryToJunctions.get(entryId);
                List<Location_Process__c> locProcesses = entryToLocProcesses.get(entryId);

                if (entry == null || processes == null || junctions == null) continue;
                if (entry.Contract_Value__c == null || entry.Contract_Value__c == 0) continue;

                // Calculate total process weight
                Decimal totalWeight = 0;
                Map<Id, Decimal> weightMap = new Map<Id, Decimal>();
                for (Scope_Entry_Process__c p : processes) {
                    Decimal w = p.Weight__c != null ? p.Weight__c : 0;
                    totalWeight += w;
                    weightMap.put(p.Id, w);
                }
                if (totalWeight == 0) continue;

                // Calculate total location quantity
                Decimal totalQty = 0;
                Map<Id, Decimal> qtyMap = new Map<Id, Decimal>();
                for (Location_Scope_Entry__c j : junctions) {
                    Decimal q = j.Location__r.Quantity__c != null ? j.Location__r.Quantity__c : 0;
                    totalQty += q;
                    qtyMap.put(j.Location__c, q);
                }
                if (totalQty == 0) continue;

                // Build existing location-process map for this entry
                Map<String, Location_Process__c> existingMap = new Map<String, Location_Process__c>();
                Map<Id, Integer> locationMaxSequence = new Map<Id, Integer>();
                
                if (locProcesses != null) {
                    for (Location_Process__c lp : locProcesses) {
                        String key = lp.Location__c + '_' + lp.Scope_Entry_Process__c;
                        existingMap.put(key, lp);
                        
                        // Track the maximum sequence number for each location
                        Integer currentSeq = lp.Sequence__c != null ? lp.Sequence__c.intValue() : 0;
                        Integer maxSeq = locationMaxSequence.get(lp.Location__c);
                        if (maxSeq == null || currentSeq > maxSeq) {
                            locationMaxSequence.put(lp.Location__c, currentSeq);
                        }
                    }
                }

                // Create or update each location-process combination
                Map<Id, Integer> locationSequenceCounters = new Map<Id, Integer>();
                
                for (Scope_Entry_Process__c proc : processes) {
                    Decimal weight = weightMap.get(proc.Id);
                    if (weight == null || weight == 0) continue;

                    for (Location_Scope_Entry__c junc : junctions) {
                        Decimal locQty = qtyMap.get(junc.Location__c);
                        if (locQty == null || locQty == 0) continue;

                        Decimal locShare = locQty / totalQty;
                        Decimal weightShare = weight / totalWeight;
                        Decimal newPrice = entry.Contract_Value__c * locShare * weightShare;

                        String key = junc.Location__c + '_' + proc.Id;
                        if (existingMap.containsKey(key)) {
                            toUpdate.add(new Location_Process__c(
                                Id = existingMap.get(key).Id,
                                Contract_Price__c = newPrice
                            ));
                        } else {
                            // Create missing Location Process with next available sequence for this location
                            if (!locationSequenceCounters.containsKey(junc.Location__c)) {
                                // Initialize counter with max existing sequence + 1
                                Integer maxSeq = locationMaxSequence.get(junc.Location__c);
                                locationSequenceCounters.put(junc.Location__c, 
                                    maxSeq != null ? maxSeq + 1 : 1);
                            }
                            
                            toInsert.add(new Location_Process__c(
                                Location__c = junc.Location__c,
                                Scope_Entry_Process__c = proc.Id,
                                Process_Library__c = proc.Process_Library__c,
                                Sequence__c = locationSequenceCounters.get(junc.Location__c),
                                Contract_Price__c = newPrice
                            ));
                            // Increment sequence counter for this location
                            locationSequenceCounters.put(junc.Location__c, 
                                locationSequenceCounters.get(junc.Location__c) + 1);
                        }
                    }
                }
            }

            // DML operations
            if (!toInsert.isEmpty()) {
                insert toInsert;
            }
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

      @AuraEnabled(cacheable=true)
    public static Map<String, Object> getBidsWithProposals(String jobId) {
        Map<String, Object> result = new Map<String, Object>();
        List<Map<String, Object>> bidsWithData = new List<Map<String, Object>>();
        
        try {
            // Query bids with Status = 'Closed Won' related to the job
            List<Bid__c> bids = [
                SELECT Id, Name, Status__c, 
                       (SELECT Id, Name, Type__c, Total_Sales_Price__c, Margin__c, Status__c 
                        FROM Proposals__r 
                        WHERE Status__c = 'Approved'
                        ORDER BY CreatedDate DESC)
                FROM Bid__c 
                WHERE Job__c = :jobId 
                AND Status__c = 'Closed Won'
                ORDER BY CreatedDate DESC
            ];
            
            for (Bid__c bid : bids) {
                Map<String, Object> bidData = new Map<String, Object>();
                bidData.put('Id', bid.Id);
                bidData.put('Name', bid.Name);
                bidData.put('Status__c', bid.Status__c);
                
                // Process proposals for this bid
                List<Map<String, Object>> proposals = new List<Map<String, Object>>();
                
                for (Proposal__c proposal : bid.Proposals__r) {
                    Map<String, Object> proposalData = new Map<String, Object>();
                    proposalData.put('Id', proposal.Id);
                    proposalData.put('Name', proposal.Name);
                    proposalData.put('Type__c', proposal.Type__c);
                    proposalData.put('Sales_Price__c', proposal.Total_Sales_Price__c);
                    proposalData.put('Margin__c', proposal.Margin__c);
                    proposalData.put('Status__c', proposal.Status__c);
                    proposalData.put('recordUrl', '/lightning/r/Proposal__c/' + proposal.Id + '/view');
                    
                    // Query proposal lines for this proposal
                    List<Proposal_Line__c> lines = [
                        SELECT Id, Name, Description__c, Sales_Price__c
                        FROM Proposal_Line__c 
                        WHERE Proposal__c = :proposal.Id
                        ORDER BY CreatedDate
                    ];
                    
                    List<Map<String, Object>> proposalLines = new List<Map<String, Object>>();
                    for (Proposal_Line__c line : lines) {
                        Map<String, Object> lineData = new Map<String, Object>();
                        lineData.put('Id', line.Id);
                        lineData.put('Name', line.Name);
                        lineData.put('Description__c', line.Description__c);
                        lineData.put('Sales_Price__c', line.Sales_Price__c);
                        proposalLines.add(lineData);
                    }
                    
                    proposalData.put('proposalLines', proposalLines);
                    proposals.add(proposalData);
                }
                
                bidData.put('proposals', proposals);
                bidsWithData.add(bidData);
            }
            
            result.put('success', true);
            result.put('bids', bidsWithData);
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getBidsWithProposals','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error fetching bids with proposals for job ID: ' + jobId,'apiResponse' => null});
            result.put('success', false);
            result.put('error', e.getMessage());
        }
        
        return result;
    }

    @AuraEnabled
public static Map<String, Object> createScopeEntriesFromProposalLines(String scopeEntriesDataJson) {
    Map<String, Object> result = new Map<String, Object>();
    
    try {
        List<Map<String, Object>> scopeEntriesData = (List<Map<String, Object>>) JSON.deserializeUntyped(scopeEntriesDataJson);
        List<wfrecon__Scope_Entry__c> scopeEntriesToCreate = new List<wfrecon__Scope_Entry__c>();
        List<String> createdEntryIds = new List<String>();
        
        for (Map<String, Object> entryData : scopeEntriesData) {
            wfrecon__Scope_Entry__c newEntry = new wfrecon__Scope_Entry__c();
            newEntry.Name = (String) entryData.get('name');
            newEntry.wfrecon__Contract_Value__c = (Decimal) entryData.get('contractValue');
            newEntry.wfrecon__Description__c = (String) entryData.get('description');
            newEntry.wfrecon__Job__c = (Id) entryData.get('jobId');
            newEntry.wfrecon__Type__c = (String) entryData.get('type');
            
            // Set default status
            newEntry.wfrecon__Scope_Entry_Status__c = 'Draft';
            
            // Store source information if needed (you might want to create a custom field for this)
            // newEntry.wfrecon__Source_Proposal_Line__c = (String) entryData.get('sourceProposalLineId');
            
            scopeEntriesToCreate.add(newEntry);
        }
        
        if (!scopeEntriesToCreate.isEmpty()) {
            insert scopeEntriesToCreate;
            
            // Collect the created entry IDs
            for (wfrecon__Scope_Entry__c entry : scopeEntriesToCreate) {
                createdEntryIds.add(entry.Id);
            }
            
            result.put('success', true);
            result.put('createdEntries', scopeEntriesToCreate.size());
            result.put('createdEntryIds', createdEntryIds);
        } else {
            result.put('success', false);
            result.put('error', 'No scope entries to create');
        }
        
    } catch (Exception e) {
        result.put('success', false);
        result.put('error', e.getMessage() + ' - ' + e.getStackTraceString());
    }
    
    return result;
}
}