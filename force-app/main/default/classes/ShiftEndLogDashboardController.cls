/**
* Class Name: ShiftEndLogDashboardController
* @description: Controller for Shift End Log Dashboard Component
* Created Date: 25 November 2025
**/
public with sharing class ShiftEndLogDashboardController {
    
    /**
     * @description: Get all shift end logs with relevant data
     * @param dateFilter: String filter option (last7days, last15days, last30days, alltime)
     * @return: DashboardData - Dashboard data with KPIs and log entries
     */
    @AuraEnabled
    public static DashboardData getShiftEndLogDashboardData(String dateFilter) {
        try {
            DashboardData dashboardData = new DashboardData();
            
            // Calculate date range based on filter
            Date startDate;
            
            if (dateFilter == 'last7days') {
                startDate = Date.today().addDays(-7);
            } else if (dateFilter == 'last15days') {
                startDate = Date.today().addDays(-15);
            } else if (dateFilter == 'last30days') {
                startDate = Date.today().addDays(-30);
            } else if (dateFilter == 'alltime') {
                startDate = Date.newInstance(2000, 1, 1);
            }
            
            // Build query
            String query = 'SELECT Id, Name, wfrecon__Exceptions__c, wfrecon__Job__c, wfrecon__Job__r.Id, ' +
                          'wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.Name, wfrecon__Mobilization__c, ' +
                          'wfrecon__Notes_to_Office__c, wfrecon__Plan_for_Tomorrow__c, wfrecon__Work_Performed__c, ' +
                          'wfrecon__Status__c, wfrecon__Travel_Log_Complete__c, wfrecon__Work_Performed_Date__c, ' +
                          'wfrecon__Approval_Data__c, CreatedDate, CreatedBy.Name, CreatedBy.Id ' +
                          'FROM wfrecon__Log_Entry__c ';
            
            if (startDate != null) {
                query += 'WHERE CreatedDate >= :startDate ';
            }
            
            query += 'ORDER BY CreatedDate DESC';
            
            List<wfrecon__Log_Entry__c> logEntries = Database.query(query);
            
            // Calculate KPIs
            dashboardData.totalLogs = logEntries.size();
            dashboardData.pendingLogs = 0;
            dashboardData.approvedLogs = 0;
            dashboardData.rejectedLogs = 0;
            dashboardData.autoApprovedLogs = 0;
            
            // Process results
            dashboardData.logEntries = new List<ShiftEndLogWrapper>();
            
            for (wfrecon__Log_Entry__c log : logEntries) {
                ShiftEndLogWrapper wrapper = new ShiftEndLogWrapper();
                wrapper.id = log.Id;
                wrapper.name = log.Name;
                wrapper.jobId = log.wfrecon__Job__r.Id;
                wrapper.jobNumber = log.wfrecon__Job__c != null ? log.wfrecon__Job__r.Name : '--';
                wrapper.jobName = log.wfrecon__Job__c != null ? log.wfrecon__Job__r.wfrecon__Job_Name__c : '--';
                wrapper.workPerformed = log.wfrecon__Work_Performed__c != null ? log.wfrecon__Work_Performed__c : '--';
                wrapper.planForTomorrow = log.wfrecon__Plan_for_Tomorrow__c != null ? log.wfrecon__Plan_for_Tomorrow__c : '--';
                wrapper.exceptions = log.wfrecon__Exceptions__c != null ? log.wfrecon__Exceptions__c : '--';
                wrapper.notesToOffice = log.wfrecon__Notes_to_Office__c != null ? log.wfrecon__Notes_to_Office__c : '--';
                wrapper.createdDate = log.CreatedDate.format('MMM dd, yyyy HH:mm');
                wrapper.createdBy = log.CreatedBy.Name;
                wrapper.createdById = log.CreatedBy.Id;
                wrapper.status = log.wfrecon__Status__c != null ? log.wfrecon__Status__c : 'Pending';
                wrapper.approvalData = log.wfrecon__Approval_Data__c;
                
                // Update KPIs
                if (wrapper.status == 'Pending') {
                    dashboardData.pendingLogs++;
                } else if (wrapper.status == 'Approved') {
                    dashboardData.approvedLogs++;
                } else if (wrapper.status == 'Rejected') {
                    dashboardData.rejectedLogs++;
                } else if (wrapper.status == 'Auto-Approved') {
                    dashboardData.autoApprovedLogs++;
                }
                
                dashboardData.logEntries.add(wrapper);
            }
            
            return dashboardData;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ShiftEndLogDashboardController',
                'methodName' => 'getShiftEndLogDashboardData',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
            return new DashboardData();
        }
    }
    
    /**
     * @description: Get files attached to a shift end log
     * @param logEntryId: Id of the log entry
     * @return: List<FileWrapper> - List of attached files
     */
    @AuraEnabled
    public static List<FileWrapper> getLogEntryFiles(Id logEntryId) {
        try {
            List<FileWrapper> files = new List<FileWrapper>();
            
            List<ContentDocumentLink> cdLinks = [
                SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileExtension,
                       ContentDocument.ContentSize, ContentDocument.CreatedDate, ContentDocument.LatestPublishedVersionId
                FROM ContentDocumentLink 
                WHERE LinkedEntityId = :logEntryId 
                WITH USER_MODE
            ];
            
            for (ContentDocumentLink cdl : cdLinks) {
                FileWrapper fw = new FileWrapper();
                fw.id = cdl.ContentDocumentId;
                fw.versionId = cdl.ContentDocument.LatestPublishedVersionId;
                fw.title = cdl.ContentDocument.Title;
                fw.fileExtension = cdl.ContentDocument.FileExtension != null ? cdl.ContentDocument.FileExtension.toLowerCase() : '';
                fw.fileSize = formatFileSize(cdl.ContentDocument.ContentSize);
                fw.isImage = isImageFile(fw.fileExtension);
                fw.isPdf = fw.fileExtension == 'pdf';
                fw.isDoc = isDocFile(fw.fileExtension);
                fw.downloadUrl = '/sfc/servlet.shepherd/document/download/' + cdl.ContentDocumentId;
                fw.previewUrl = '/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=' + fw.versionId;
                files.add(fw);
            }
            
            return files;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ShiftEndLogDashboardController',
                'methodName' => 'getLogEntryFiles',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
            return new List<FileWrapper>();
        }
    }
    
    /**
     * @description: Helper method to check if file is an image
     */
    private static Boolean isImageFile(String extension) {
        Set<String> imageExtensions = new Set<String>{'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'};
        return extension != null && imageExtensions.contains(extension.toLowerCase());
    }
    
    /**
     * @description: Helper method to check if file is a document
     */
    private static Boolean isDocFile(String extension) {
        Set<String> docExtensions = new Set<String>{'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'};
        return extension != null && docExtensions.contains(extension.toLowerCase());
    }
    
    /**
     * @description: Helper method to format file size
     */
    private static String formatFileSize(Integer bytes) {
        if (bytes == null) {
            return '0 B';
        }
        if (bytes < 1024) {
            return bytes + ' B';
        }
        if (bytes < 1048576) {
            return (bytes / 1024) + ' KB';
        }
        return (bytes / 1048576) + ' MB';
    }
    
    /**
     * @description: Wrapper class for dashboard data
     */
    public class DashboardData {
        @AuraEnabled public Integer totalLogs { get; set; }
        @AuraEnabled public Integer pendingLogs { get; set; }
        @AuraEnabled public Integer approvedLogs { get; set; }
        @AuraEnabled public Integer rejectedLogs { get; set; }
        @AuraEnabled public Integer autoApprovedLogs { get; set; }
        @AuraEnabled public List<ShiftEndLogWrapper> logEntries { get; set; }
        
        public DashboardData() {
            this.totalLogs = 0;
            this.pendingLogs = 0;
            this.approvedLogs = 0;
            this.rejectedLogs = 0;
            this.autoApprovedLogs = 0;
            this.logEntries = new List<ShiftEndLogWrapper>();
        }
    }
    
    /**
     * @description: Wrapper class for shift end log
     */
    public class ShiftEndLogWrapper {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public Id jobId { get; set; }
        @AuraEnabled public String jobNumber { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String workPerformed { get; set; }
        @AuraEnabled public String planForTomorrow { get; set; }
        @AuraEnabled public String exceptions { get; set; }
        @AuraEnabled public String notesToOffice { get; set; }
        @AuraEnabled public String createdDate { get; set; }
        @AuraEnabled public String createdBy { get; set; }
        @AuraEnabled public Id createdById { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String approvalData { get; set; }
    }
    
    /**
     * @description: Wrapper class for file attachments
     */
    public class FileWrapper {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public Id versionId { get; set; }
        @AuraEnabled public String title { get; set; }
        @AuraEnabled public String fileExtension { get; set; }
        @AuraEnabled public String fileSize { get; set; }
        @AuraEnabled public Boolean isImage { get; set; }
        @AuraEnabled public Boolean isPdf { get; set; }
        @AuraEnabled public Boolean isDoc { get; set; }
        @AuraEnabled public String downloadUrl { get; set; }
        @AuraEnabled public String previewUrl { get; set; }
    }
}