/**
* Class Name: SovJobLocationsController
* Test Class: Pending
* @description: Controller for SOV Locations Tab which is in Job Detail Page
* Created Date: 3 October 2025
* Created By: Rachit Shah
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/

public with sharing class SovJobLocationsController {

    public static final string CLASSNAME = 'SovJobLocationsController';

   /*
    *********************************************************
    @description     : Method is used to dynamically get Location Entries for a Job with all related processes preloaded
    @param           : Id jobId - Job Id
    @return          : Map<String, Object> - Map containing location entries and their process data
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getLocationEntries(Id jobId) {
        Map<String, Object> result = new Map<String, Object>();
        List<SObject> locationEntries = new List<SObject>();
        Map<Id, List<wfrecon__Location_Process__c>> locationProcessMap = new Map<Id, List<wfrecon__Location_Process__c>>();
        
        try {
            String objectName = 'wfrecon__Location__c';
            
            // Get all accessible fields dynamically
            String allLocationFields = getAllFields(objectName);
            
            if (String.isNotBlank(allLocationFields)) {
                // Build dynamic SOQL without Job relationship fields
                String query = 'SELECT ' + allLocationFields +
                            ' FROM ' + objectName +
                            ' WHERE wfrecon__Job__c = :jobId ' +
                            ' ORDER BY CreatedDate DESC';
                
                locationEntries = Database.query(query, AccessLevel.USER_MODE);

                if (!locationEntries.isEmpty()) {
                    // --- Collect all Location IDs ---
                    Set<Id> locationIds = new Set<Id>();
                    for (SObject entry : locationEntries) {
                        locationIds.add(entry.Id);
                    }

                    // --- Fetch all related Location Processes in bulk ---
                    List<wfrecon__Location_Process__c> allLocationProcesses = [
                        SELECT Id, Name, wfrecon__Contract_Price__c, wfrecon__Completed_Percentage__c, 
                            wfrecon__Current_Completed_Value__c, wfrecon__Process_Status__c, 
                            wfrecon__Scope_Entry_Process__r.wfrecon__Process_Name__c,
                            wfrecon__Sequence__c, wfrecon__Location__c, wfrecon__Process_Name__c
                        FROM wfrecon__Location_Process__c
                        WHERE wfrecon__Location__c IN :locationIds
                        WITH USER_MODE
                        ORDER BY wfrecon__Sequence__c ASC NULLS LAST, CreatedDate ASC
                    ];

                    // --- Group processes by location ---
                    for (wfrecon__Location_Process__c process : allLocationProcesses) {
                        Id locationId = process.wfrecon__Location__c;
                        if (!locationProcessMap.containsKey(locationId)) {
                            locationProcessMap.put(locationId, new List<wfrecon__Location_Process__c>());
                        }
                        locationProcessMap.get(locationId).add(process);
                    }
                }
            }

            result.put('locationEntries', locationEntries);
            result.put('locationProcessMap', locationProcessMap);
            result.put('success', true);
            
            // Debug logs
            System.debug('LocationEntries getLocationEntries - Found ' + locationEntries.size() + ' locations');
            System.debug('LocationEntries getLocationEntries - Process map has ' + locationProcessMap.size() + ' entries');

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getLocationEntries', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching Location Entries with processes dynamically for Job ID: ' + jobId,'apiResponse' => null});
            result.put('locationEntries', new List<SObject>());
            result.put('locationProcessMap', new Map<Id, List<wfrecon__Location_Process__c>>());
            result.put('success', false);
            result.put('error', e.getMessage());
        }
        return result;
    }


    /*
    *********************************************************
    @description     : Method to convert field names to relationship field format
    @param           : String fieldsList - Comma-separated field names
    @param           : String relationshipName - Relationship name (e.g., 'wfrecon__Job__r')
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
    @description     : Method is used to create a new Location Entry
    @param           : Map<String, Object> locationData - Location Entry data
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String createLocationEntry(Map<String, Object> locationData) {
        try {
            wfrecon__Location__c newLocation = new wfrecon__Location__c();
            newLocation.Name = (String) locationData.get('name');
            newLocation.wfrecon__Quantity__c = (Decimal) locationData.get('quantity');
            newLocation.wfrecon__Unit_of_Measure__c = (String) locationData.get('unitOfMeasure');
            newLocation.wfrecon__Job__c = (Id) locationData.get('jobId');
            
            insert as user newLocation;
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'createLocationEntry','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while creating Location Entry.','apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Method is used to delete multiple Location Entries
    @param           : List<Id> locationIds - List of Location Ids to delete
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String deleteLocationEntries(List<Id> locationIds) {
        try {
            if (locationIds.isEmpty()) {
                return 'Error: No records selected for deletion';
            }
            
            // Get all location processes that will be affected by location deletion
            List<wfrecon__Location_Process__c> locationProcessesToDelete = [
                SELECT Id, wfrecon__Scope_Entry_Process__c, wfrecon__Scope_Entry_Process__r.wfrecon__Scope_Entry__c,
                       wfrecon__Location__c, wfrecon__Contract_Price__c
                FROM wfrecon__Location_Process__c 
                WHERE wfrecon__Location__c IN :locationIds 
                WITH USER_MODE
            ];
            
            // Collect affected scope entry IDs for recalculation
            Set<Id> affectedScopeEntryIds = new Set<Id>();
            for (wfrecon__Location_Process__c lp : locationProcessesToDelete) {
                if (lp.wfrecon__Scope_Entry_Process__r.wfrecon__Scope_Entry__c != null) {
                    affectedScopeEntryIds.add(lp.wfrecon__Scope_Entry_Process__r.wfrecon__Scope_Entry__c);
                }
            }
            
            // Delete the locations (this will cascade delete location processes due to lookup relationship)
            List<wfrecon__Location__c> locationsToDelete = [
                SELECT Id 
                FROM wfrecon__Location__c 
                WHERE Id IN :locationIds 
                WITH USER_MODE
            ];
            
            delete as user locationsToDelete;
            
            // Recalculate remaining location processes for affected scope entries
            if (!affectedScopeEntryIds.isEmpty()) {

                // Get all affected scope entries with their contract values
                Map<Id, wfrecon__Scope_Entry__c> scopeEntries = new Map<Id, wfrecon__Scope_Entry__c>([
                    SELECT Id, wfrecon__Contract_Value__c
                    FROM wfrecon__Scope_Entry__c
                    WHERE Id IN :affectedScopeEntryIds
                    WITH USER_MODE
                ]);

                String recalcResult = SovJobScopeController.recalculateLocationProcessesBulk(scopeEntries);
                if (!recalcResult.startsWith('Success')) {
                    // Log recalculation error but don't fail the deletion
                    ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'deleteLocationEntries','isApiException' => false,'statusCode' => null,'exceptionObj' => null,'moreDetails' => 'Location deletion succeeded but recalculation failed: ' + recalcResult,'apiResponse' => null});
                    return 'Success: Locations deleted, but some recalculation issues occurred. ' + recalcResult;
                }
                return 'Success: ' + locationIds.size() + ' location(s) deleted and remaining processes recalculated.';
            }
            
            return 'Success: ' + locationIds.size() + ' location(s) deleted.';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'deleteLocationEntries','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while deleting Location Entries.','apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Method is used to get Location Configuration
    @return          : Map<String, Object> - Configuration data
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getLocationConfiguration() {
        Map<String, Object> configData = new Map<String, Object>();
        
        try {
            List<wfrecon__LocationConfigration__mdt> configs = [
                SELECT wfrecon__FieldValue__c, wfrecon__PageSize__c 
                FROM wfrecon__LocationConfigration__mdt 
                WITH USER_MODE 
                LIMIT 1
            ];

            if (!configs.isEmpty()) {
                wfrecon__LocationConfigration__mdt config = configs[0];
                configData.put('fieldsData', config.wfrecon__FieldValue__c);
                configData.put('pageSize', config.wfrecon__PageSize__c);
            } else {
                configData.put('fieldsData', '');
                configData.put('pageSize', 10);
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getLocationConfiguration','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while fetching Location Configuration.','apiResponse' => null});
        }

        return configData;
    }

    /*
    *********************************************************
    @description     : Method is used to save inline edits for multiple Location Entries
    @param           : String updatedLocationsJson - JSON string of updated location records
    @return          : String - Success or error message
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static String saveInlineEdits(String updatedLocationsJson) {
        try {
            if (String.isBlank(updatedLocationsJson)) {
                return 'Error: No location data provided for update.';
            }

            List<wfrecon__Location__c> updatedLocations =
                (List<wfrecon__Location__c>) JSON.deserialize(updatedLocationsJson, List<wfrecon__Location__c>.class);

            if (updatedLocations == null || updatedLocations.isEmpty()) {
                return 'Error: No location records provided for update.';
            }

            // Step 1: Fetch original wfrecon__Quantity__c for change detection
            Set<Id> locationIds = new Set<Id>();
            for (wfrecon__Location__c loc : updatedLocations) {
                locationIds.add(loc.Id);
            }

            Map<Id, Decimal> originalSqFtMap = new Map<Id, Decimal>();
            for (wfrecon__Location__c oldLoc : [
                SELECT Id, wfrecon__Quantity__c, wfrecon__Unit_of_Measure__c
                FROM wfrecon__Location__c
                WHERE Id IN :locationIds
                WITH USER_MODE
            ]) {
                originalSqFtMap.put(oldLoc.Id, oldLoc.wfrecon__Quantity__c);
            }

            // Step 2: Identify which locations had quantity feet changes
            Set<Id> changedLocationIds = new Set<Id>();
            for (wfrecon__Location__c newLoc : updatedLocations) {
                Decimal oldSqFt = originalSqFtMap.get(newLoc.Id);
                Decimal newSqFt = newLoc.wfrecon__Quantity__c;

                if ((oldSqFt == null && newSqFt != null) ||
                    (oldSqFt != null && newSqFt == null) ||
                    (oldSqFt != null && newSqFt != null && oldSqFt != newSqFt)) {
                    changedLocationIds.add(newLoc.Id);
                }
            }

            // Step 3: Perform the DML update
            Database.SaveResult[] results = Database.update(updatedLocations, false, AccessLevel.USER_MODE);

            List<String> failedRecords = new List<String>();
            Integer successCount = 0;

            for (Integer i = 0; i < results.size(); i++) {
                if (results[i].isSuccess()) {
                    successCount++;
                } else {
                    String errMsg = '';
                    for (Database.Error e : results[i].getErrors()) {
                        errMsg += e.getMessage() + '; ';
                    } 
                    failedRecords.add(updatedLocations[i].Id + ': ' + errMsg);
                }
            }

            // Step 4: Trigger recalculation if any square footage changed
            String recalculationMsg = '';
            if (!changedLocationIds.isEmpty()) {
                recalculationMsg = recalculateForChangedLocations(changedLocationIds);
            }

            // Step 5: Build response message
            String finalMsg = '';
            if (!failedRecords.isEmpty()) {
                finalMsg = 'Partial Success: ' + successCount + ' location(s) updated successfully. Failed: ' +
                        String.join(failedRecords, ', ');
            } else {
                finalMsg = 'Success: ' + successCount + ' location(s) updated successfully.';
            }

            if (!String.isBlank(recalculationMsg)) {
                finalMsg += ' ' + recalculationMsg;
            }

            return finalMsg;

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'saveInlineEdits','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while saving inline edits and recalculating contract prices.','apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    public static String recalculateForChangedLocations(Set<Id> changedLocationIds) {
        try {
            if (changedLocationIds == null || changedLocationIds.isEmpty()) {
                return 'No locations changed for recalculation.';
            }

            // Get related Scope Entries via wfrecon__Location_Process__c
            Map<Id, Id> locationToScopeEntry = new Map<Id, Id>();
            for (wfrecon__Location_Process__c lp : [
                SELECT wfrecon__Location__c, wfrecon__Scope_Entry_Process__r.wfrecon__Scope_Entry__c
                FROM wfrecon__Location_Process__c
                WHERE wfrecon__Location__c IN :changedLocationIds
                WITH USER_MODE
            ]) {
                locationToScopeEntry.put(lp.wfrecon__Location__c, lp.wfrecon__Scope_Entry_Process__r.wfrecon__Scope_Entry__c);
            }

            if (locationToScopeEntry.isEmpty()) {
                return 'No related scope entries found for changed locations.';
            }

            // Collect all affected Scope Entry IDs
            Set<Id> scopeEntryIds = new Set<Id>(locationToScopeEntry.values());

            // Fetch related Scope Entries with their contract values
            Map<Id, wfrecon__Scope_Entry__c> scopeEntries = new Map<Id, wfrecon__Scope_Entry__c>(
                [SELECT Id, wfrecon__Contract_Value__c
                FROM wfrecon__Scope_Entry__c
                WHERE Id IN :scopeEntryIds
                WITH USER_MODE]
            );

            // Reuse existing recalculation logic
            String result = SovJobScopeController.recalculateLocationProcessesBulk(scopeEntries);

            return result;

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'recalculateForChangedLocations','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while recalculating processes for changed locations.','apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }



    /*
    *********************************************************
    @description     : Method is used to get picklist values for a field
    @param           : String objectApiName - API name of the object
    @param           : String fieldApiName - API name of the field
    @return          : List<String> - List of picklist values
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled(cacheable=true)
    public static List<String> getPicklistValuesForField(String objectApiName, String fieldApiName) {
        List<String> picklistValues = new List<String>();
        try {
            Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
            
            if (globalDescribe.containsKey(objectApiName)) {
                Schema.SObjectType objectType = globalDescribe.get(objectApiName);
                Schema.DescribeSObjectResult objectDescribe = objectType.getDescribe();
                Map<String, Schema.SObjectField> fieldMap = objectDescribe.fields.getMap();
                
                if (fieldMap.containsKey(fieldApiName)) {
                    Schema.SObjectField field = fieldMap.get(fieldApiName);
                    Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
                    
                    if (fieldDescribe.getType() == Schema.DisplayType.PICKLIST) {
                        List<Schema.PicklistEntry> picklistEntries = fieldDescribe.getPicklistValues();
                        for (Schema.PicklistEntry entry : picklistEntries) {
                            if (entry.isActive()) {
                                picklistValues.add(entry.getValue());
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME,'methodName' => 'getPicklistValuesForField','isApiException' => false,'statusCode' => null,'exceptionObj' => e,'moreDetails' => 'Error occurred while getting picklist values.','apiResponse' => null});
        }
        return picklistValues;
    }
}