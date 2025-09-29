public with sharing class LookupFieldController {
    @AuraEnabled
    public static List<sObject> searchRecord(
        String objectAPIName,
        String fieldAPIName,
        String andConditionField,
        String andConditionValue,
        String andBooleanField,
        String isEqual,
        String andConditionListField,
        List<String> andConditionListValue,
        List<String> moreFields,
        String searchText,
        Integer recordLimit
    ) {
            List<sObject> objectList = new List<sObject>();
            searchText = '%' + String.escapeSingleQuotes(searchText.trim()) + '%';
            String soqlQuery = 'SELECT Id, Name';

            if (!moreFields.isEmpty())
                soqlQuery = soqlQuery + ',' + String.join(moreFields, ',');

            if (objectAPIName == 'Job__c') {
                soqlQuery =
                    soqlQuery +
                    ' FROM ' +
                    objectAPIName +
                    ' WHERE (' +
                    fieldAPIName +
                    ' LIKE :arg1  OR Name LIKE :arg2 )';
            } else {
                soqlQuery = soqlQuery + ' FROM ' + objectAPIName + ' WHERE ' + fieldAPIName + ' LIKE :arg3 ';
            }

            if (String.isNotEmpty(andConditionField) && String.isNotBlank(andConditionField)) {
                soqlQuery = soqlQuery + ' AND ' + andConditionField + ' = :arg4';
            }

            if (String.isNotEmpty(andConditionListField) && String.isNotBlank(andConditionListField)) {
                soqlQuery = soqlQuery + ' AND ' + andConditionListField + ' IN :arg5';
            }

            if (objectAPIName == 'User') {
                soqlQuery = soqlQuery + ' AND IsActive = true ';
            }

            if (String.isNotEmpty(andBooleanField) && String.isNotBlank(andBooleanField)) {
            
                soqlQuery = soqlQuery + ' AND ' + andBooleanField + ' = ' + isEqual;
            }

            soqlQuery = soqlQuery + ' WITH SECURITY_ENFORCED LIMIT ' + recordLimit;
            objectList = Lib_Security.ws().dbQuery(soqlQuery, new Object[]{searchText,searchText,searchText,andConditionValue,andConditionListValue});

            return objectList;
        
    }
}