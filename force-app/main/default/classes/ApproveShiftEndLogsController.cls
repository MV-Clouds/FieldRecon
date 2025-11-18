/**
* Class Name: ApproveShiftEndLogsController
* @description: Controller for Approve Shift End Logs Component
* Created Date: 18 November 2025
**/
public with sharing class ApproveShiftEndLogsController {
    
    /**
     * @description: Method to get unapproved log entries based on date filter
     * @param dateFilter: String filter option (last7days, last15days, last30days, alltime)
     * @return: List<LogEntryWrapper> - List of log entry records
     */
    @AuraEnabled
    public static List<LogEntryWrapper> getUnapprovedLogEntries(String dateFilter) {
        try {
            List<LogEntryWrapper> result = new List<LogEntryWrapper>();
            
            // Calculate date range based on filter
            Date startDate;
            Date endDate = Date.today();
            
            if (dateFilter == 'last7days') {
                startDate = Date.today().addDays(-7);
            } else if (dateFilter == 'last15days') {
                startDate = Date.today().addDays(-15);
            } else if (dateFilter == 'last30days') {
                startDate = Date.today().addDays(-30);
            } else if (dateFilter == 'alltime') {
                startDate = Date.newInstance(2000, 1, 1); // Set to a far past date
            }
            
            // Build query
            String query = 'SELECT Id, Name, wfrecon__Exceptions__c, wfrecon__Job__c, wfrecon__Job__r.Name, ' +
                          'wfrecon__Mobilization__c, wfrecon__Notes_to_Office__c, wfrecon__Plan_for_Tomorrow__c, ' +
                          'wfrecon__Status__c, wfrecon__Travel_Log_Complete__c, wfrecon__Work_Performed_Date__c, ' +
                          'CreatedDate, CreatedBy.Name ' +
                          'FROM wfrecon__Log_Entry__c ' +
                          'WHERE wfrecon__Status__c = \'Pending\'';
            
            if (startDate != null) {
                query += ' AND wfrecon__Work_Performed_Date__c >= :startDate';
            }
            
            query += ' ORDER BY wfrecon__Work_Performed_Date__c DESC';
            
            List<wfrecon__Log_Entry__c> logEntries = Database.query(query);
            
            // Process results
            for (wfrecon__Log_Entry__c log : logEntries) {
                LogEntryWrapper wrapper = new LogEntryWrapper();
                wrapper.Id = log.Id;
                wrapper.entryNumber = log.Name;
                wrapper.jobName = log.wfrecon__Job__c != null ? log.wfrecon__Job__r.Name : 'N/A';
                wrapper.submittedDate = log.wfrecon__Work_Performed_Date__c != null ? 
                                       log.wfrecon__Work_Performed_Date__c.format() : 'N/A';
                wrapper.submittedBy = log.CreatedBy.Name;
                wrapper.status = log.wfrecon__Status__c;
                
                result.add(wrapper);
            }
            
            return result;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching log entries: ' + e.getMessage());
        }
    }
    
    /**
     * @description: Wrapper class for Log Entry data
     */
    public class LogEntryWrapper {
        @AuraEnabled public Id Id { get; set; }
        @AuraEnabled public String entryNumber { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String submittedDate { get; set; }
        @AuraEnabled public String submittedBy { get; set; }
        @AuraEnabled public String status { get; set; }
    }
}