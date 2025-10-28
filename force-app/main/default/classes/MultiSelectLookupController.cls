public with sharing class MultiSelectLookupController {
    //This method retrieves the data from database table. It search input is '*', then retrieve all records
    @AuraEnabled (cacheable=true)
    public static List<SObjectQueryResult> retrieveRecords(String objectName, 
                                                    String fieldAPINames,
                                                    String filterFieldAPIName,
                                                    String strInput){
        
        List<SObjectQueryResult> lstReturnResult = new List<SObjectQueryResult>();
        if(strInput.equals('*')){
            strInput = '';
        }
        String str = '%' + strInput + '%';
        String strQueryField = '';
        List<String> fieldList = fieldAPINames.split(',');
        Object[] arguments = new Object[]{str};
        System.debug(arguments);
        //check if Id is already been passed
        if(!fieldList.contains('Id')){
            fieldList.add('Id');
            strQueryField = String.join(fieldList, ',');
        }else {
            strQueryField = fieldAPINames;
        }

        String strQuery = 'SELECT ' + String.escapeSingleQuotes(strQueryField) 
                        + ' FROM ' 
                        + String.escapeSingleQuotes(objectName) 
                        + ' WHERE ' + filterFieldAPIName + '  LIKE :arg1 AND '
                        + ' User__c = NULL' 
                        + ' ORDER BY ' + filterFieldAPIName
                        + ' LIMIT 50';
                        
        System.debug('strQuery=' + strQuery);

        List<SObject> lstResult = Lib_Security.ws().dbQuery(strQuery,arguments);
        //create list of records that can be easily be parsable at js controller.
        for(String strField:fieldList){
            for(SObject sobj:lstResult){                
                if(strField != 'Id'){
                    SObjectQueryResult result = new SObjectQueryResult();
                    result.recordId = (String) sobj.get('Id');
                    result.recordName = (String) sobj.get(strField);
                    lstReturnResult.add(result);
                }                
            }
        }
        return lstReturnResult;
    }
    
    public class SObjectQueryResult {
        @AuraEnabled
        public String recordId;

        @AuraEnabled
        public String recordName;
    }
}