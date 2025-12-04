// /**
// * Class Name: JobMetricsController
// * Test Class: 
// * @description: Controller for Job data Report
// * Created Date: 4 December 2025
// * Created By: Kajal Tiwari
// *--------------------------------------------------------------------------------
// * Modification History: Change custom metadata to custom setting
// * Date Modified - Developer Name - Description
// * 
// **/

public with sharing class JobMetricsController {
    
    public class MetricData {
        @AuraEnabled public Integer count { get; set; }
        @AuraEnabled public Decimal totalValue { get; set; }
        
        public MetricData() {
            this.count = 0;
            this.totalValue = 0;
        }
    }

    /*
    *********************************************************
    @description     : Method to get all jobs with their scope entry data for calculations
                    Can filter by recently viewed jobs or return all jobs
    @param           : Boolean filterByRecentlyViewed - Whether to filter by recently viewed jobs
    @return          : List<JobData> - List of jobs with calculated metrics
    ********************************************************
    */
    @AuraEnabled(cacheable=true)
    public static List<JobData> getAllJobsWithScopeData(Boolean filterByRecentlyViewed) {
        List<JobData> jobDataList = new List<JobData>();
        Set<Id> jobIdsToQuery = new Set<Id>();
        
        try {
            // If filtering by recently viewed, get the recently viewed job IDs
            if (filterByRecentlyViewed) {
                jobIdsToQuery = getRecentlyViewedJobIds();
                
                // If no recently viewed jobs found, return empty list
                if (jobIdsToQuery.isEmpty()) {
                    return jobDataList;
                }
            }
            
            // Build dynamic query based on filter
            String query = 'SELECT Id, Name, wfrecon__Job_Name__c, wfrecon__Status__c, wfrecon__Job_Number__c, ' +
                        'wfrecon__Total_Contract_Price__c, ' +
                        'wfrecon__Total_Contract_Value__c, ' +
                        'wfrecon__Total_Change_Order_Value__c ' +
                        'FROM wfrecon__Job__c ';
            
            // Add WHERE clause if filtering by recently viewed
            if (filterByRecentlyViewed && !jobIdsToQuery.isEmpty()) {
                query += 'WHERE Id IN :jobIdsToQuery ';
            }
            
            query += 'ORDER BY LastViewedDate DESC NULLS LAST, Name ASC';
            
            // Get jobs based on filter
            List<wfrecon__Job__c> jobs = Database.query(query);
            
            if (jobs.isEmpty()) {
                System.debug('=== No jobs found with the current filter');
                return jobDataList;
            }
            
            System.debug('=== Found ' + jobs.size() + ' jobs, filterByRecentlyViewed: ' + filterByRecentlyViewed);
            
            // Get job IDs for all queries
            Set<Id> jobIds = new Set<Id>();
            for (wfrecon__Job__c job : jobs) {
                jobIds.add(job.Id);
            }
            
            // 1. Aggregate scope entry data by job to get total completed value
            Map<Id, Decimal> jobCompletedValueMap = new Map<Id, Decimal>();
            AggregateResult[] scopeResults = [
                SELECT wfrecon__Job__c jobId, 
                    SUM(wfrecon__Current_Complete_Value__c) totalCompleted
                FROM wfrecon__Scope_Entry__c
                WHERE wfrecon__Job__c IN :jobIds
                AND wfrecon__Current_Complete_Value__c != null
                WITH USER_MODE
                GROUP BY wfrecon__Job__c
            ];
            
            for (AggregateResult ar : scopeResults) {
                Id jobId = (Id)ar.get('jobId');
                Decimal totalCompleted = (Decimal)ar.get('totalCompleted');
                jobCompletedValueMap.put(jobId, totalCompleted);
            }
            
            // 2. Get most recent approved bill for each job
            Map<Id, wfrecon__Billing__c> latestApprovedBillsMap = new Map<Id, wfrecon__Billing__c>();
            
            // Query for the most recent approved bill per job
            for (wfrecon__Billing__c bill : [
                SELECT Id, wfrecon__Job__c, wfrecon__Total_Billed_Amount__c, 
                    wfrecon__Retainage_Completed_to_Date__c, CreatedDate
                FROM wfrecon__Billing__c
                WHERE wfrecon__Job__c IN :jobIds
                AND wfrecon__Status__c = 'Approved'
                WITH USER_MODE
                ORDER BY wfrecon__Job__c, CreatedDate DESC
            ]) {
                // Only keep the most recent bill for each job
                if (!latestApprovedBillsMap.containsKey(bill.wfrecon__Job__c)) {
                    latestApprovedBillsMap.put(bill.wfrecon__Job__c, bill);
                }
            }
            
            // 3. Aggregate payment data by job
            Map<Id, Decimal> jobTotalPaymentsMap = new Map<Id, Decimal>();
            AggregateResult[] paymentResults = [
                SELECT wfrecon__Job__c jobId, 
                    SUM(wfrecon__Payable_Amount_Received__c) totalPaid
                FROM wfrecon__Payment__c
                WHERE wfrecon__Job__c IN :jobIds
                AND wfrecon__Payable_Amount_Received__c != null
                WITH USER_MODE
                GROUP BY wfrecon__Job__c
            ];
            
            for (AggregateResult ar : paymentResults) {
                Id jobId = (Id)ar.get('jobId');
                Decimal totalPaid = (Decimal)ar.get('totalPaid');
                jobTotalPaymentsMap.put(jobId, totalPaid);
            }
            
            // Create JobData objects with all calculations
            for (wfrecon__Job__c job : jobs) {
                JobData data = new JobData();
                data.jobId = job.Id;
                data.jobName = job.wfrecon__Job_Name__c;
                data.jobNumber = job.Name;
                data.status = job.wfrecon__Status__c;
                data.baseContract = job.wfrecon__Total_Contract_Value__c != null ? job.wfrecon__Total_Contract_Value__c : 0;
                data.changeOrder = job.wfrecon__Total_Change_Order_Value__c != null ? job.wfrecon__Total_Change_Order_Value__c : 0;
                data.totalCompletedValue = jobCompletedValueMap.get(job.Id) != null ? jobCompletedValueMap.get(job.Id) : 0;
                
                // Calculate total contract
                Decimal totalContract = data.baseContract + data.changeOrder;
                
                // Billing data
                wfrecon__Billing__c latestBill = latestApprovedBillsMap.get(job.Id);
                if (latestBill != null) {
                    // Use the most recent approved bill's Total Billed Amount
                    data.billedAmount = latestBill.wfrecon__Total_Billed_Amount__c != null ? latestBill.wfrecon__Total_Billed_Amount__c : 0;
                    // Use the most recent approved bill's Retainage Completed to Date
                    data.retainageHeld = latestBill.wfrecon__Retainage_Completed_to_Date__c != null ? latestBill.wfrecon__Retainage_Completed_to_Date__c : 0;
                } else {
                    data.billedAmount = 0;
                    data.retainageHeld = 0;
                }
                
                // Payment data - sum of all payments
                data.paidAmount = jobTotalPaymentsMap.get(job.Id) != null ? jobTotalPaymentsMap.get(job.Id) : 0;
                
                // Balance calculation: Total Contract - Billed Amount (from most recent approved bill only)
                Decimal totalBilledRecent = latestBill != null ? latestBill.wfrecon__Total_Billed_Amount__c : 0;
                data.balanceAmount = totalContract - totalBilledRecent;
                
                jobDataList.add(data);
            }
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'JobMetricsController', 
                'methodName' => 'getAllJobsWithScopeData', 
                'exceptionObj' => e, 
                'moreDetails' => e.getMessage()
            });
        }
        
        return jobDataList;
    }

    /*
    *********************************************************
    @description     : Helper method to get recently viewed job IDs
    @return          : Set<Id> - Set of recently viewed job IDs
    ********************************************************
    */
    private static Set<Id> getRecentlyViewedJobIds() {
        Set<Id> recentlyViewedJobIds = new Set<Id>();
        
        try {
            // Query RecentlyViewed object to get recently viewed Job__c records
            List<RecentlyViewed> recentViews = [
                SELECT Id, Name, Type, LastViewedDate
                FROM RecentlyViewed 
                WHERE Type = 'wfrecon__Job__c' 
                ORDER BY LastViewedDate DESC 
            ];
            
            for (RecentlyViewed rv : recentViews) {
                recentlyViewedJobIds.add(rv.Id);
            }
                    
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'JobMetricsController', 
                'methodName' => 'getRecentlyViewedJobIds', 
                'exceptionObj' => e, 
                'moreDetails' => e.getMessage()
            });
        }
        
        return recentlyViewedJobIds;
    }

        /*
    *********************************************************
    @description     : Method to get job metrics for dashboard cards with custom metadata
    @return          : Map<String, MetricData> - Status related data
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, MetricData> getJobMetrics() {
        Map<String, MetricData> metrics = new Map<String, MetricData>();
        
        try {
                    wfrecon__JobMetrics__c[] metricSettings = wfrecon__JobMetrics__c.getAll().values();
        
        // Collect all statuses from all metrics
        Set<String> allStatuses = new Set<String>();
        Map<String, Set<String>> metricToStatuses = new Map<String, Set<String>>();
        
        // Initialize metrics for all custom setting records
        for (wfrecon__JobMetrics__c setting : metricSettings) {
            metrics.put(setting.Name, new MetricData());
            
            if (setting.wfrecon__Statuses__c != null) {
                Set<String> statusSet = new Set<String>();
                List<String> statusList = setting.wfrecon__Statuses__c.split(',');
                for (String status : statusList) {
                    statusSet.add(status.trim());
                }
                metricToStatuses.put(setting.Name, statusSet);
                allStatuses.addAll(statusSet);
            }
        }


            if (allStatuses.isEmpty()) {
                System.debug('=== No statuses found in custom metadata');
                return metrics;
            }
            
            // Get all jobs with their financial data
            List<wfrecon__Job__c> jobs = [
                SELECT Id, Name, wfrecon__Status__c, 
                    wfrecon__Total_Contract_Price__c,
                    wfrecon__Total_Paid_Amount__c  
                FROM wfrecon__Job__c 
                WHERE wfrecon__Status__c IN :allStatuses
                WITH USER_MODE
            ];
            
            if (jobs.isEmpty()) {
                System.debug('=== No jobs found with the specified statuses');
                return metrics;
            }
            
            // Get job IDs for billing query only
            Set<Id> jobIds = new Set<Id>();
            for (wfrecon__Job__c job : jobs) {
                jobIds.add(job.Id);
            }
            
            // Get most recent approved bill for each job
            Map<Id, wfrecon__Billing__c> latestApprovedBillsMap = new Map<Id, wfrecon__Billing__c>();
            for (wfrecon__Billing__c bill : [
                SELECT Id, wfrecon__Job__c, wfrecon__Total_Billed_Amount__c, CreatedDate
                FROM wfrecon__Billing__c
                WHERE wfrecon__Job__c IN :jobIds
                AND wfrecon__Status__c = 'Approved'
                WITH USER_MODE
                ORDER BY wfrecon__Job__c, CreatedDate DESC
            ]) {
                if (!latestApprovedBillsMap.containsKey(bill.wfrecon__Job__c)) {
                    latestApprovedBillsMap.put(bill.wfrecon__Job__c, bill);
                }
            }
                        
            // Calculate metrics for each job based on custom settings
            for (wfrecon__Job__c job : jobs) {
                Decimal totalContract = job.wfrecon__Total_Contract_Price__c != null ? job.wfrecon__Total_Contract_Price__c : 0;

                wfrecon__Billing__c latestBill = latestApprovedBillsMap.get(job.Id);
                Decimal recentBilledAmount = latestBill != null && latestBill.wfrecon__Total_Billed_Amount__c != null ? 
                                        latestBill.wfrecon__Total_Billed_Amount__c : 0;
                
                Decimal totalPaidAmount = job.Total_Paid_Amount__c != null ? job.Total_Paid_Amount__c : 0;
                
                Decimal openBalance = recentBilledAmount - totalPaidAmount;
                Decimal pendingAmount = totalContract - recentBilledAmount;
                                
                for (String metricName : metricToStatuses.keySet()) {
                    Set<String> statuses = metricToStatuses.get(metricName);
                    if (statuses != null && statuses.contains(job.wfrecon__Status__c)) {
                        MetricData currentMetric = metrics.get(metricName);
                        if (currentMetric != null) {
                            currentMetric.count++;
                            
                            if (metricName == 'openBalance') {
                                currentMetric.totalValue += openBalance;
                                System.debug('=== Added to ' + metricName + ': openBalance = ' + openBalance);
                            } else if (metricName == 'workRemaining') {
                                currentMetric.totalValue += pendingAmount;
                                System.debug('=== Added to ' + metricName + ': pendingAmount = ' + pendingAmount);
                            } else {
                                // For backlog, inProgress, retainagePending - use total contract value
                                currentMetric.totalValue += totalContract;
                                System.debug('=== Added to ' + metricName + ': totalContract = ' + totalContract);
                            }
                        }
                    }
                }
            }
                        
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobMetricsController', 'methodName' => 'getJobMetrics', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});

            return initializeEmptyMetrics();
        }
        
        return metrics;
    }
    
    /*
    *********************************************************
    @description     : Method to get metric settings for popup
    @return          : Map<String, Object> - Metric settings and status options
    ********************************************************
    */
    @AuraEnabled
    public static Map<String, Object> getMetricSettings() {
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            // Get all available status picklist values
            List<Map<String, String>> statusOptions = new List<Map<String, String>>();
            Schema.DescribeFieldResult fieldResult = wfrecon__Job__c.wfrecon__Status__c.getDescribe();
            List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
            
            for (Schema.PicklistEntry entry : ple) {
                if (entry.isActive()) {
                    statusOptions.add(new Map<String, String>{
                        'label' => entry.getLabel(),
                        'value' => entry.getValue()
                    });
                }
            }
            
                    wfrecon__JobMetrics__c[] metricSettings = wfrecon__JobMetrics__c.getAll().values();

            Map<String, List<String>> metricStatusMap = new Map<String, List<String>>();
            
            // Define default metric names
            List<String> defaultMetrics = new List<String>{
                'backlog', 'inProgress', 'openBalance', 'retainagePending', 'workRemaining'
            };
            
            for (String metricName : defaultMetrics) {
                metricStatusMap.put(metricName, new List<String>());
            }
            
            for (wfrecon__JobMetrics__c setting : metricSettings) {
            if (setting.wfrecon__Statuses__c != null) {
                metricStatusMap.put(setting.Name, setting.wfrecon__Statuses__c.split(','));
            }
        }
            
            result.put('statusOptions', statusOptions);
            result.put('metricStatusMap', metricStatusMap);
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobMetricsController', 'methodName' => 'getMetricSettings', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});

        }
        
        return result;
    }
    
    /*
*********************************************************
@description     : Method to save metric settings using Custom Settings
@param           : Map<String, List<String>> - Metric to statuses mapping
********************************************************
*/
@AuraEnabled
public static void saveMetricSettings(Map<String, List<String>> metricStatusMap) {
    try {
        List<wfrecon__JobMetrics__c> settingsToUpsert = new List<wfrecon__JobMetrics__c>();
        
        for (String metricName : metricStatusMap.keySet()) {
            List<String> statuses = metricStatusMap.get(metricName);
            String statusesString = String.join(statuses, ',');
            
            // Create or update custom setting record
            wfrecon__JobMetrics__c setting = new wfrecon__JobMetrics__c(
                Name = metricName,
                wfrecon__Statuses__c = statusesString
            );
            settingsToUpsert.add(setting);
        }
        
        // UPSERT the custom settings
        if (!settingsToUpsert.isEmpty()) {
            upsert settingsToUpsert Name; 
        }
        
    } catch (Exception e) {
        ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobMetricsController', 'methodName' => 'saveMetricSettings', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        throw new AuraHandledException('Error saving metric settings: ' + e.getMessage());
    }
}
    
    /*
    *********************************************************
    @description     : Initialize empty metrics
    @return          : Map<String, MetricData> - Empty metrics
    ********************************************************
    */
    private static Map<String, MetricData> initializeEmptyMetrics() {
        Map<String, MetricData> emptyMetrics = new Map<String, MetricData>();
        emptyMetrics.put('backlog', new MetricData());
        emptyMetrics.put('inProgress', new MetricData());
        emptyMetrics.put('openBalance', new MetricData());
        emptyMetrics.put('retainagePending', new MetricData());
        emptyMetrics.put('workRemaining', new MetricData());
        return emptyMetrics;
    }

    // Wrapper class for job data
    public class JobData {
        @AuraEnabled public String jobId { get; set; }
        @AuraEnabled public String jobName { get; set; }
        @AuraEnabled public String jobNumber { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public Decimal baseContract { get; set; }
        @AuraEnabled public Decimal changeOrder { get; set; }
        @AuraEnabled public Decimal totalCompletedValue { get; set; }
        @AuraEnabled public Decimal billedAmount { get; set; }
        @AuraEnabled public Decimal paidAmount { get; set; }
        @AuraEnabled public Decimal balanceAmount { get; set; }
        @AuraEnabled public Decimal retainageHeld { get; set; }
        
        public JobData() {
            this.baseContract = 0;
            this.changeOrder = 0;
            this.totalCompletedValue = 0;
            this.billedAmount = 0;
            this.paidAmount = 0;
            this.balanceAmount = 0;
            this.retainageHeld = 0;
        }
    }
}