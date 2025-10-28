public with sharing class RecordManagersCmpController {

    public static final string CLASSNAME = 'RecordManagersCmpController';

    /**
     * Method Name : getObjectFields
     * @description : get object fields.
     * @param objectApiName String value.
     */
    @AuraEnabled
    public static RecordManagerData getObjectFields(String objectApiName, String featureName) {
        try {
            RecordManagerData recordData = new RecordManagerData();
            List<FieldDetails> fieldDetailsList = new List<FieldDetails>();

            Schema.DescribeSObjectResult objDescribe = Schema.getGlobalDescribe().get(objectApiName).getDescribe();
            Map<String, Schema.SObjectField> fieldsMap = objDescribe.fields.getMap();

            for (String fieldName : fieldsMap.keySet()) {
                Schema.SObjectField field = fieldsMap.get(fieldName);
                Schema.DescribeFieldResult fieldDescribe = field.getDescribe();

                FieldDetails fieldDetails = new FieldDetails();
                fieldDetails.label = fieldDescribe.getLabel();
                fieldDetails.value = fieldDescribe.getName();
                fieldDetails.fieldType = String.valueOf(fieldDescribe.getType());
                fieldDetails.isCalculated = fieldDescribe.isCalculated();

                if (fieldDescribe.getType() == Schema.DisplayType.Reference) {
                    List<Schema.SObjectType> referenceTo = fieldDescribe.getReferenceTo();
                    if (!referenceTo.isEmpty()) {
                        fieldDetails.referenceObjectName = referenceTo[0].getDescribe().getName();
                        fieldDetails.relationshipName = fieldDescribe.getRelationshipName();
                    }
                } else {
                    fieldDetails.referenceObjectName = objectApiName;
                }

                if (fieldDescribe.getType() == Schema.DisplayType.Picklist) {
                    List<PicklistValue> picklistValues = new List<PicklistValue>();
                    for (Schema.PicklistEntry picklistEntry : fieldDescribe.getPicklistValues()) {
                        PicklistValue picklistValue = new PicklistValue();
                        picklistValue.label = picklistEntry.getLabel();
                        picklistValue.value = picklistEntry.getValue();
                        picklistValues.add(picklistValue);
                    }
                    fieldDetails.picklistValues = picklistValues;
                }

                fieldDetailsList.add(fieldDetails);
            }
            recordData.fieldDetailsList = fieldDetailsList;

            List<String> metadataValues = new List<String>();
            String metadataType;
            if (featureName == 'ScopeEntry') {
                metadataType = 'wfrecon__ScopeEntryConfigration__mdt';
            }
            else if (featureName == 'LocationEntry') {
                metadataType = 'wfrecon__LocationConfigration__mdt';
            }
            else {
                return null;
            }
            
            String query = 'SELECT wfrecon__Fields_Data__c, wfrecon__PageSize__c FROM ' + String.escapeSingleQuotes(metadataType) + ' LIMIT 1';
            List<SObject> metadataRecords = Database.query(query, AccessLevel.USER_MODE);

            if (!metadataRecords.isEmpty()) {
                SObject metadataRecord = metadataRecords[0];
                String fieldsData = (String)metadataRecord.get('wfrecon__Fields_Data__c');
                String pageSize = String.valueOf(metadataRecord.get('wfrecon__PageSize__c'));
                
                // Handle null values from metadata
                metadataValues.add(fieldsData != null ? fieldsData : '[]');
                metadataValues.add(pageSize != null ? pageSize : '30');
            
            } else {
                metadataValues.add('[]'); 
                metadataValues.add('30'); 
            }

            recordData.metadataRecords = metadataValues;

            return recordData;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getObjectFields',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching object fields.',
                'apiResponse' => null
            });
            return null;
        }
    }

    /**
     * Method Name : saveMappings
     * @description : save mapping in the of the fields.
     * @param itemsData String value.
     * @param totalPages Integer value.
     * @param objectApiName String value.
     */
    @AuraEnabled
    public static void saveMappings(String itemsData, Integer totalPages, String objectApiName,String featureName) {
        try {
            String metadataType;

            if (featureName == 'ScopeEntry') {
                metadataType = 'wfrecon__ScopeEntryConfigration__mdt';
            }
            else if (featureName == 'LocationEntry') {
                metadataType = 'wfrecon__LocationConfigration__mdt';
            }
            // Will Add More Features Here
            else {
                return;
            }
      
            String developerName = 'RecordConfig';
            String masterLabel = 'RecordConfig';
            String query = 'SELECT MasterLabel, DeveloperName FROM ' + String.escapeSingleQuotes(metadataType) + ' LIMIT 1';
            List<SObject> metaList = Database.query(query, AccessLevel.USER_MODE);

            if (featureName == 'ScopeEntry') {
                wfrecon__ScopeEntryConfigration__mdt config;
                if (!metaList.isEmpty()) {
                    config = (wfrecon__ScopeEntryConfigration__mdt) metaList[0];
                    developerName = config.DeveloperName;
                    masterLabel = config.MasterLabel;
                }
            }

            else if (featureName == 'LocationEntry') {
                wfrecon__LocationConfigration__mdt config;
                if (!metaList.isEmpty()) {
                    config = (wfrecon__LocationConfigration__mdt) metaList[0];
                    developerName = config.DeveloperName;
                    masterLabel = config.MasterLabel;
                }
            }


            Metadata.CustomMetadata mdata = new Metadata.CustomMetadata();
            mdata.fullName = metadataType + '.wfrecon__' + developerName;
            mdata.label = masterLabel;

            Metadata.CustomMetadataValue fieldsDataValue = new Metadata.CustomMetadataValue();
            fieldsDataValue.field = 'wfrecon__Fields_Data__c';
            fieldsDataValue.value = itemsData;
            mdata.values.add(fieldsDataValue);

            Metadata.CustomMetadataValue pageSizeValue = new Metadata.CustomMetadataValue();
            pageSizeValue.field = 'wfrecon__PageSize__c';
            pageSizeValue.value = totalPages;
            mdata.values.add(pageSizeValue);

            Metadata.DeployContainer container = new Metadata.DeployContainer();
            container.addMetadata(mdata);

            Metadata.Operations.enqueueDeployment(container, null);
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'saveMappings',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while saving mappings.',  
                'apiResponse' => null
            });
        }
    }


    /**
     * Method Name : getObjectFieldsParent
     * @description : get listing fields parent.
     * @param objectApiName String value.
     */
    @AuraEnabled
    public static List<FieldDetails> getObjectFieldsParent(String objectApiName) {

        try {
            List<FieldDetails> fieldDetailsList = new List<FieldDetails>();

            Schema.DescribeSObjectResult objDescribe = Schema.getGlobalDescribe().get(objectApiName).getDescribe();
        
            Map<String, Schema.SObjectField> fieldsMap = objDescribe.fields.getMap();
        
            for (String fieldName : fieldsMap.keySet()) {

                Schema.SObjectField field = fieldsMap.get(fieldName);
                Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
        
                FieldDetails fieldDetails = new FieldDetails();
                fieldDetails.label = fieldDescribe.getLabel();
                fieldDetails.value = fieldDescribe.getName();
                fieldDetails.fieldType = String.valueOf(fieldDescribe.getType());
                fieldDetails.isCalculated = fieldDescribe.isCalculated(); // Add this line

                if (fieldDescribe.getType() == Schema.DisplayType.Reference) {
                    List<Schema.SObjectType> referenceTo = fieldDescribe.getReferenceTo();
                    if (!referenceTo.isEmpty()) {
                        fieldDetails.referenceObjectName = referenceTo[0].getDescribe().getName();
                    }
                }else{
                    fieldDetails.referenceObjectName = objectApiName;
                }

                if (fieldDescribe.getType() == Schema.DisplayType.Picklist) {
                    List<PicklistValue> picklistValues = new List<PicklistValue>();
                    for (Schema.PicklistEntry picklistEntry : fieldDescribe.getPicklistValues()) {
                        PicklistValue picklistValue = new PicklistValue();
                        picklistValue.label = picklistEntry.getLabel();
                        picklistValue.value = picklistEntry.getValue();
                        picklistValues.add(picklistValue);
                    }
                    fieldDetails.picklistValues = picklistValues;
                }
                fieldDetailsList.add(fieldDetails);
            }
            return fieldDetailsList;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getObjectFieldsParent',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error occurred while fetching listing fields parent.',
                'apiResponse' => null
            });
            return null;
        }
    }

    /**
    * Class Name : FieldDetails
    * @description : this is a wrapper class to pass multiple values to the LWC component.
    */
    public class FieldDetails {
        @AuraEnabled
        public String label { get; set; }
        @AuraEnabled
        public String value { get; set; }
        @AuraEnabled
        public String fieldType { get; set; }
        @AuraEnabled
        public String referenceObjectName { get; set; }
        @AuraEnabled
        public String relationshipName { get; set; }
        @AuraEnabled
        public List<PicklistValue> picklistValues { get; set; }
        @AuraEnabled
        public Boolean isCalculated { get; set; }
        
    }

    /**
    * Class Name : PicklistValue
    * @description : this is a wrapper class to represent picklist values with label and value.
    */
    public class PicklistValue {
        @AuraEnabled
        public String label { get; set; }
        @AuraEnabled
        public String value { get; set; }
    }

    public class RecordManagerData {
        @AuraEnabled public List<FieldDetails> fieldDetailsList;
        @AuraEnabled public List<String> metadataRecords;
    }
    
    public class FieldInfoWrapper {
        @AuraEnabled public String value;
        @AuraEnabled public String label;
    }
}