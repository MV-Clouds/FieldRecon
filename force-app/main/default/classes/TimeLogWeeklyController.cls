public with sharing class TimeLogWeeklyController {
    public List<document> documentList { get; set; }
    public static List<Job__c> jobdetail { get; set; }
    public static List<Timesheet_Entry__c> timeentry { get; set; }
    public static List<Timesheet_Entry_Item__c> timeentryitem { get; set; }
    
    public TimeLogWeeklyController() {
        documentList=Lib_Security.ws().dbQuery('SELECT Id, Name FROM Document WITH SECURITY_ENFORCED ORDER BY CreatedDate DESC LIMIT 1', new Object[]{});
        Id pageId = ApexPages.currentPage().getParameters().get('id');
        Date StartDate = Date.valueOf(ApexPages.currentPage().getParameters().get('StartDate'));
        Date EndDate = Date.valueOf(ApexPages.currentPage().getParameters().get('EndDate'));
        
        String relatedFields =
            ',Account__r.Name,( SELECT ' +
            Util.getDynamicFields('Timesheet__c', '') +
            ',Contact__r.User__r.Name FROM Timesheets__r WHERE Timesheet_End_Date__c <=:arg1 AND Timesheet_Start_Date__c >=:arg2)';
        String job = Util.getQueryData('Job__c', relatedFields);
        job += ' WHERE Id =:arg3 WITH SECURITY_ENFORCED';
        jobdetail = Lib_Security.ws().dbQuery(job, new Object[]{EndDate,StartDate,pageId});
        
        String relatedFields2 = ',Timesheet__r.Job__c,Timesheet__r.Contact__r.User__r.Name';
        String entry = Util.getQueryData('Timesheet_Entry__c', relatedFields2);
        entry += ' WHERE Timesheet__r.Job__c =:arg1 AND Entry_Date__c >=:arg2 WITH SECURITY_ENFORCED';
        timeentry = Lib_Security.ws().dbQuery(entry, new Object[]{pageId,StartDate});
        
        String relatedFields3 = ',Timesheet_Entry__r.Timesheet__r.Job__c,Timesheet_Entry__r.Timesheet__r.Contact__r.User__r.Name';
        String entryitem = Util.getQueryData(
            'Timesheet_Entry_Item__c',
            relatedFields3
        );
        entryitem += ' WHERE Timesheet_Entry__r.Timesheet__r.Job__c =:arg1 AND DAY_ONLY(Clock_In_Time__c) >=:arg2 AND DAY_ONLY(Clock_Out_Time__c)<=:arg3 WITH SECURITY_ENFORCED';
        timeentryitem = Lib_Security.ws().dbQuery(entryitem, new Object[]{pageId,StartDate,EndDate});
    }
}