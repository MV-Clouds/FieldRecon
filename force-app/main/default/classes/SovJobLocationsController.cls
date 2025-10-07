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
    @description     : Method is used to dynamically get Location Entries for a Job
    @param           : Id jobId - Job Id
    @return          : List<SObject> - List of Location Entries (dynamic fields)
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<SObject> getLocationEntries(Id jobId) {
        List<SObject> locationEntries = new List<SObject>();
        try {
            String objectName = 'wfrecon__Location__c';
            
            // Get all accessible fields dynamically
            String allLocationFields = getAllFields(objectName);
            String allJobFields = getAllFields('wfrecon__Job__c');
            
            if (String.isNotBlank(allLocationFields)) {
                // Build dynamic SOQL with Job relationship fields
                String query = 'SELECT ' + allLocationFields;
                
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
                
                locationEntries = Database.query(query, AccessLevel.USER_MODE);
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getLocationEntries',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Location Entries dynamically.',
                'apiResponse' => null
            });
        }
        return locationEntries;
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
            newLocation.wfrecon__Square_Feet__c = (Decimal) locationData.get('squareFeet');
            newLocation.wfrecon__Crack_Count__c = (Decimal) locationData.get('crackCount');
            newLocation.wfrecon__Distressed_Edge__c = (Decimal) locationData.get('distressedEdge');
            newLocation.wfrecon__Distressed_Joint_LF__c = (Decimal) locationData.get('distressedJoint');
            newLocation.wfrecon__Misc_Defect_Count__c = (Decimal) locationData.get('miscDefectCount');
            newLocation.wfrecon__Cure_Time_Days__c = (Decimal) locationData.get('cureTimeDays');
            newLocation.wfrecon__Job__c = (Id) locationData.get('jobId');
            
            insert as user newLocation;
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'createLocationEntry',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while creating Location Entry.',
                'apiResponse' => null
            });
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
            
            List<wfrecon__Location__c> locationsToDelete = [
                SELECT Id 
                FROM wfrecon__Location__c 
                WHERE Id IN :locationIds 
                WITH USER_MODE
            ];
            
            delete as user locationsToDelete;
            return 'Success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'deleteLocationEntries',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while deleting Location Entries.',
                'apiResponse' => null
            });
            return 'Error: ' + e.getMessage();
        }
    }

    /*
    *********************************************************
    @description     : Method is used to get Location Process details
    @param           : Id locationId - Location Id
    @return          : List<wfrecon__Location_Process__c> - List of Process records
    @author          : Rachit Shah
    ********************************************************
    */
    @AuraEnabled
    public static List<wfrecon__Location_Process__c> getLocationProcesses(Id locationId) {
        List<wfrecon__Location_Process__c> processes = new List<wfrecon__Location_Process__c>();
        try {
            processes = [
                SELECT Id, Name, wfrecon__Contract_Price__c, wfrecon__Completed_Percentage__c, 
                       wfrecon__Current_Completed_Value__c, wfrecon__Process_Status__c, 
                       wfrecon__Sequence__c, wfrecon__Location__c
                FROM wfrecon__Location_Process__c
                WHERE wfrecon__Location__c = :locationId
                WITH USER_MODE
                ORDER BY wfrecon__Sequence__c ASC NULLS LAST, CreatedDate ASC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getLocationProcesses',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Location Processes for Location ID: ' + locationId,
                'apiResponse' => null
            });
        }
        return processes;
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
                SELECT FieldsData__c, PageSize__c 
                FROM wfrecon__LocationConfigration__mdt 
                WITH USER_MODE 
                LIMIT 1
            ];

            if (!configs.isEmpty()) {
                wfrecon__LocationConfigration__mdt config = configs[0];
                configData.put('fieldsData', config.FieldsData__c);
                configData.put('pageSize', config.PageSize__c);
            } else {
                configData.put('fieldsData', '');
                configData.put('pageSize', 10);
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getLocationConfiguration',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching Location Configuration.',
                'apiResponse' => null
            });
        }

        return configData;
    }
}