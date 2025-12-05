public with sharing class AI_JobSummaryPageController {

    public static String summaryData  {get;set;}
    public static Map<String, Object> Label {get; set;}
    public static Map<String, Object> JobOverview {get; set;}
    public static Map<String, Object> ShiftLogSummary {get; set;}
    public static List<Object> EachLogSummary {get; set;}
    public static List<Object> NotesForOffice {get; set;}
    public static Map<String, Object> OverallJobHealthSummary {get; set;}
    public static Object FinalSummary {get; set;}
    public static Map<String, Object> ReportMetaData {get; set;}
    public static Date ReportDate {get; set;}

    public AI_JobSummaryPageController() {
        Job_Summary_AI__c jobSummary = new Job_Summary_AI__c();
        Label = defaultLabels;
        try {
            if(ApexPages.currentPage().getParameters() != null){

                // Fetch Job Summary Record if jobSummaryId is provided
                String jobSummaryId = ApexPages.currentPage().getParameters().get('jobSummaryId');
                
                List<Job_Summary_AI__c> slinst = [SELECT Summary_Data_Raw__c, Is_Temporary__c FROM Job_Summary_AI__c];
                System.debug('slinst size: ' + slinst);
                System.debug('slinst size: ' + slinst.size());

                // This section is to handle the scenario where the summary data is to large to pass in parameter, So that data stored in a Job_Summary_AI__c record
                // OR get summary data from existing record
                if(String.isNotBlank(jobSummaryId)){
                    List<Job_Summary_AI__c> jobSummaryList = [SELECT Summary_Data_Raw__c, Is_Temporary__c FROM Job_Summary_AI__c WHERE Id = :jobSummaryId LIMIT 1];
                    if(jobSummaryList.size() > 0){
                        jobSummary = jobSummaryList[0];
                        summaryData = jobSummary.Summary_Data_Raw__c;
                    }
                }
                else{
                    // If the jobSummaryId is not provided, Means summary data has been passed through parameter
                    // get the summary data from parameter
                    summaryData = ApexPages.currentPage().getParameters().get('summary');
                    System.debug('summaryData length from param: ' + summaryData);
                }

                if(String.isNotBlank(summaryData)){
                    // Deserialize the summary data and collect the necessary information
                    Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(summaryData);
                    System.debug('data : ' + data);
                    Label = ((Map<String, Object>) data.get('Label')) ?? defaultLabels;
                    JobOverview = (Map<String, Object>) data.get('JobOverview');
                    ShiftLogSummary = (Map<String, Object>) data.get('ShiftLogSummary');
                    EachLogSummary = (List<Object>) JSON.deserializeUntyped(JSON.serialize(ShiftLogSummary?.get('EachLogSummary')));
                    // if(EachLogSummary != null && EachLogSummary.size() == 0) EachLogSummary = null;
                    NotesForOffice = (List<Object>) data.get('NotesForOffice');
                    // if(NotesForOffice != null && NotesForOffice.size() == 0) EachLogSummary = null;
                    OverallJobHealthSummary = (Map<String, Object>) data.get('OverallJobHealthSummary');
                    FinalSummary = (Object) data.get('FinalSummary');
                    ReportMetaData = (Map<String, Object>) data.get('ReportMetaData');
                    if( ReportMetaData?.get('ReportDate') != null){
                        ReportDate =  ((Date) Date.valueOf((String) ReportMetaData?.get('ReportDate') ?? ''));
                    }
                }
                else{
                    System.debug('No Summary Data Found');
                }
            }
        } catch (Exception e) {
            System.debug('Exception in AI_JobSummaryPageController Constructor: ' + e.getMessage());
        }
    }


    Map<String, Object> defaultLabels = new Map<String, Object>{
        'JobOverviewTitle' => 'Job Overview',
        'JobName' => 'Job Name',
        'Status' => 'Status',
        'Location' => 'Location',
        'ContractPrice' => 'Contract Price',
        'TotalManHoursLogged' => 'Total Man Hours Logged',
        'TotalContractValue' => 'Total Contract Value',
        'Mobilizations' => 'Mobilizations',
        'WorkProgressSummaryTitle' => 'Work Progress Summary (By Each Day)',
        'GroupedByWorkDates' => 'Grouped by Work Dates:',
        'Date' => 'Date',
        'SummaryOfKeyWorkActivities' => 'Summary of Key Work Activities',
        'OverallWorkSummary' => 'Overall Summary',
        'ExceptionsChallengesTitle' => 'Exceptions / Challenges',
        'ExceptionCause' => 'Exception / Cause',
        'ExceptionOverallSummary' => 'Summary',
        'NotesForOfficeTitle' => 'Notes for Office',
        'OverallJobHealthSummaryTitle' => 'Overall Job Health Summary',
        'ScheduleProgress' => 'Schedule Progress',
        'CommunicationEfficiency' => 'Communication Efficiency',
        'ResourceUtilization' => 'Resource Utilization',
        'DocumentationStatus' => 'Documentation Status',
        'FinalSummaryTitle' => 'Final Summary',
        'ReportDate' => 'Report Date'
    };

}