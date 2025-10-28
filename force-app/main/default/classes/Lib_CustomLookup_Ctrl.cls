/* @author - Concret.io
   @since  - 01/01/2020
   @version - 1.1
   @Description - this class will fetch data according to passed 
                  object name,email and field which renders on UI  
 */
public inherited sharing class Lib_CustomLookup_Ctrl {
    
    /**
    * this method return the list of sobject which record passes the filtered criteria
    * @param    searchKeyWord      =>    searched text or user name
    * @param    objectName         =>    any object name
    * @param    fieldName          =>    any field name which is containing by that object
    * @param    soqlFilterImplName =>    soql filter
    * @return   List<SObject>      =>    list of records that passes the metioned criteria
    */
    @AuraEnabled
    public static List <sObject> fetchLookUpValues(String searchKeyWord, String objectName, String fieldName, String soqlFilterImplName) {
        
        String searchKey = searchKeyWord + '%';
        String sQuery='';
        List <sObject> returnList = new List <sObject>();

        // create fields search criteria to serach
        String fieldSearchCriteria = ' ( Name LIKE :arg1 ';
        if(fieldName != null){
            for(String f: fieldName.split(',')){
                fieldSearchCriteria += ' OR '+ f+ ' LIKE :arg1 ';
            }
        }
        fieldSearchCriteria += ' ) ';

        if (!String.isBlank(soqlFilterImplName)) {
            Lib_CustomLookup_SOQLFilter soqlFilter = (Lib_CustomLookup_SOQLFilter) Type.forName(soqlFilterImplName).newInstance(); 
            String whereClause = soqlFilter.prepare(searchKeyWord, objectName, fieldName);
            fieldSearchCriteria += ' AND ' + whereClause;
        }
      
        // Create a Dynamic SOQL Query For Fetch Record List with LIMIT 5    
        sQuery =  'SELECT Id, Name FROM '+ObjectName +' WHERE '+fieldSearchCriteria+' WITH SECURITY_ENFORCED ORDER BY CreatedDate DESC LIMIT 5';        
        
        return Lib_Security.ws().dbQuery(sQuery,new Object[]{searchKey});
    }    
    
    /**
    * method for getting any dynamic record using id and object name
    * @param    id           =>    id of that record whome you want to access
    * @param    objectName   =>    any object name
    * @return   SObject      =>    object that passes the provided criteria
    */
    @AuraEnabled
    public static SObject getRecordName(String id, String objectName) {
        String recordSOQL = 'SELECT id,Name'+
            '  FROM ' + objectName +
            ' WHERE Id = :arg1 WITH SECURITY_ENFORCED';
        SObject[] records = Lib_Security.ws().dbQuery(recordSOQL,new Object[]{id});
        return records[0];
    }
}