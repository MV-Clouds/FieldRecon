public with sharing class ContactConfigController {

    @AuraEnabled
    public static RecordManagerData getContactFields() {
        try {
            RecordManagerData recordData = new RecordManagerData();
            List<FieldDetails> fieldDetailsList = new List<FieldDetails>();

            // Fetch Contact Fields
            Map<String, Schema.SObjectField> fieldsMap = Contact.SObjectType.getDescribe().fields.getMap();

            for (String fieldName : fieldsMap.keySet()) {
                Schema.DescribeFieldResult fr = fieldsMap.get(fieldName).getDescribe();
                FieldDetails fd = new FieldDetails();
                fd.label = fr.getLabel();
                fd.value = fr.getName();
                fd.fieldType = String.valueOf(fr.getType());
                fd.isCalculated = fr.isCalculated();
                fieldDetailsList.add(fd);
            }
            recordData.fieldDetailsList = fieldDetailsList;

            // Fetch Metadata
            List<ContactConfigration__mdt> mdt = [
                SELECT FieldValue__c, PageSize__c 
                FROM ContactConfigration__mdt 
                WHERE DeveloperName = 'RecordConfig' 
                LIMIT 1
            ];

            List<String> metaValues = new List<String>();
            if (!mdt.isEmpty()) {
                metaValues.add(mdt[0].FieldValue__c != null ? mdt[0].FieldValue__c : '[]');
                metaValues.add(String.valueOf(mdt[0].PageSize__c));
            } else {
                metaValues.add('[]'); 
                metaValues.add('30'); 
            }
            recordData.metadataRecords = metaValues;

            return recordData;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void saveContactConfig(String itemsData, Integer totalPages) {
        try {
            Metadata.CustomMetadata mdata = new Metadata.CustomMetadata();
            mdata.fullName = 'ContactConfigration__mdt.RecordConfig';
            mdata.label = 'RecordConfig';

            Metadata.CustomMetadataValue val = new Metadata.CustomMetadataValue();
            val.field = 'FieldValue__c';
            val.value = itemsData;
            mdata.values.add(val);

            Metadata.DeployContainer container = new Metadata.DeployContainer();
            container.addMetadata(mdata);
            Metadata.Operations.enqueueDeployment(container, null);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    public class RecordManagerData {
        @AuraEnabled public List<FieldDetails> fieldDetailsList;
        @AuraEnabled public List<String> metadataRecords;
    }
    public class FieldDetails {
        @AuraEnabled public String label;
        @AuraEnabled public String value;
        @AuraEnabled public String fieldType;
        @AuraEnabled public Boolean isCalculated;
    }
}