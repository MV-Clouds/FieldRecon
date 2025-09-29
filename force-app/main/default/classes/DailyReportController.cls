public with sharing class DailyReportController {
    public List<document> documentList { get; set; }
    public List<Job__c> jobdetail { get; set; }

    public DailyReportController(ApexPages.StandardController stdController) {
        documentList = Lib_Security.ws()
            .dbQuery(
                'SELECT Id, Name FROM document WITH SECURITY_ENFORCED ORDER BY CreatedDate DESC LIMIT 1',
                new List<Object>{}
            );
        Id pageId = stdController.getId();
        Date dt = System.Today().addDays(-6);
        Date dt1 = System.today();
        String relatedFields =
            ',Account__r.Name, ( SELECT ' +
            Util.getDynamicFields('Timesheet__c', '') +
            ',Contact__r.User__r.Name FROM Timesheets__r), (SELECT ' +
            Util.getDynamicFields('Expense__c', '') +
            ' FROM Expenses__r WHERE Transaction_Date__c >=: arg1)';
        String job = Util.getQueryData('Job__c', relatedFields);
        job += ' WHERE Id = :arg2';

        jobdetail = Lib_Security.ws().dbQuery(job, new List<Object>{ dt, pageId });
    }
}