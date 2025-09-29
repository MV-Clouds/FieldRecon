public inherited sharing class TimeSheetReport_UserSOQLFilter implements Lib_CustomLookup_SOQLFilter {
    public String prepare(String searchKeyword, String sobjectName, String fieldName) {
        return 'RecordType.DeveloperName = \'Employee_WF_Recon\' AND User__c != null';
    }
}