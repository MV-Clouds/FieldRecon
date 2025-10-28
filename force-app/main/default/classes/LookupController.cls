public with sharing class LookupController {
    @AuraEnabled
    public static List<sObject> searchRecord(String objectAPIName, String fieldAPIName, 
                                             String andConditionField, String andConditionValue, 
                                             List<String> moreFields, String searchText,
                                             Integer recordLimit,Boolean isEqual)
    {
        List<sObject> objectList =  new List<sObject>();
        
        searchText='\'%' + String.escapeSingleQuotes(searchText.trim()) + '%\'';
        
        String soqlQuery = 'SELECT Id, Name';
        
        if(!moreFields.isEmpty()){
            soqlQuery = soqlQuery + ',' + String.join(moreFields, ',') ;
        }
        
        if(objectAPIName == 'Job__c'){
            soqlQuery = soqlQuery + ' FROM ' + objectAPIName 
            + ' WHERE (' + fieldAPIName
            + ' LIKE ' + searchText +
            + ' OR Job_Name__c LIKE ' + searchText +') '; 
        }
        else{
            soqlQuery = soqlQuery + ' FROM ' + objectAPIName 
            + ' WHERE ' + fieldAPIName
            + ' LIKE ' + searchText;
        }
        
        if(String.isNotEmpty(andConditionField) && String.isNotBlank(andConditionField) 
           && String.isNotEmpty(andConditionValue) && String.isNotBlank(andConditionValue)){
               if(isEqual == true) soqlQuery = soqlQuery + ' AND ' + andConditionField + ' =:arg1';
               else soqlQuery = soqlQuery + ' AND ' + andConditionField + ' !=: arg1';
           }            				  
        soqlQuery = soqlQuery + ' LIMIT ' + recordLimit;

        objectList = Lib_Security.ws().dbQuery(soqlQuery,new Object[]{andConditionValue});
        System.debug(objectList);
        return objectList;
    }
    @AuraEnabled
    public static String getNamespace(){
        try {
            return Util.getNamespaceWithUnderscore();
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}