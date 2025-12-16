@IsTest
public class JobMetricsControllerTest {
    
    @TestSetup
    static void setupTestData() {
        // Create test jobs with different statuses
        List<wfrecon__Job__c> testJobs = new List<wfrecon__Job__c>{
            new wfrecon__Job__c(
                wfrecon__Job_Name__c = 'Test Job 1',
                wfrecon__Job_Number__c = 'J001',
                wfrecon__Status__c = 'In Progress',
                wfrecon__Total_Contract_Price__c = 120000
            ),
            new wfrecon__Job__c(
                wfrecon__Job_Name__c = 'Test Job 2',
                wfrecon__Job_Number__c = 'J002',
                wfrecon__Status__c = 'Backlog',
                wfrecon__Total_Contract_Price__c = 50000
            ),
            new wfrecon__Job__c(
                wfrecon__Job_Name__c = 'Test Job 3',
                wfrecon__Job_Number__c = 'J003',
                wfrecon__Status__c = 'Pending',
                wfrecon__Total_Contract_Price__c = 90000
            )
        };
        insert testJobs;

        // Create scope entries for jobs
        List<wfrecon__Scope_Entry__c> scopeEntries = new List<wfrecon__Scope_Entry__c>();
        for (wfrecon__Job__c job : testJobs) {
            scopeEntries.add(new wfrecon__Scope_Entry__c(
                wfrecon__Job__c = job.Id,
                Name = 'Scope Entry for ' + job.wfrecon__Job_Name__c
            ));
        }
        insert scopeEntries;

        // Create billing records
        List<wfrecon__Billing__c> billings = new List<wfrecon__Billing__c>();
        for (wfrecon__Job__c job : testJobs) {
            billings.add(new wfrecon__Billing__c(
                wfrecon__Job__c = job.Id,
                wfrecon__Status__c = 'Approved'
            ));
        }
        insert billings;
    }

    @IsTest
    static void testGetAllJobsWithScopeData() {
        Test.startTest();
        List<JobMetricsController.JobData> jobDataList = JobMetricsController.getAllJobsWithScopeData(false);
        Test.stopTest();

        System.assertNotEquals(null, jobDataList, 'Job data list should not be null');
        System.assertEquals(3, jobDataList.size(), 'Should return data for all 3 test jobs');

        // Verify data for first job
        JobMetricsController.JobData firstJobData = jobDataList[0];
        System.assertEquals('Test Job 1', firstJobData.jobName, 'Job name should match');
        System.assertEquals('In Progress', firstJobData.status, 'Job status should match');
        
    }

    @IsTest
    static void testGetAllJobsWithScopeData_NoData() {
        // Delete all test data to test empty scenario
        delete [SELECT Id FROM wfrecon__Job__c];

        Test.startTest();
        List<JobMetricsController.JobData> jobDataList = JobMetricsController.getAllJobsWithScopeData(false);
        Test.stopTest();

        System.assertNotEquals(null, jobDataList, 'Should return empty list instead of null');
        System.assertEquals(0, jobDataList.size(), 'Should return empty list when no jobs exist');
    }

    @IsTest
    static void testGetJobMetrics() {
        // Create custom setting records for testing
        List<wfrecon__JobMetrics__c> testSettings = new List<wfrecon__JobMetrics__c>{
            new wfrecon__JobMetrics__c(
                Name = 'backlog',
                wfrecon__Statuses__c = 'Backlog,Not Started'
            ),
            new wfrecon__JobMetrics__c(
                Name = 'inProgress',
                wfrecon__Statuses__c = 'In Progress'
            ),
            new wfrecon__JobMetrics__c(
                Name = 'openBalance',
                wfrecon__Statuses__c = 'In Progress,Pending'
            ),
            new wfrecon__JobMetrics__c(
                Name = 'retainagePending',
                wfrecon__Statuses__c = 'Completed'
            ),
            new wfrecon__JobMetrics__c(
                Name = 'workRemaining',
                wfrecon__Statuses__c = 'In Progress,Pending'
            )
        };
        insert testSettings;
        
        // Update test job data to match the statuses in custom settings
        List<wfrecon__Job__c> jobs = [SELECT Id, wfrecon__Status__c FROM wfrecon__Job__c];
        jobs[0].wfrecon__Status__c = 'In Progress';
        jobs[0].wfrecon__Total_Contract_Price__c = 100000;
        jobs[1].wfrecon__Status__c = 'Backlog';
        jobs[1].wfrecon__Total_Contract_Price__c = 50000;
        jobs[2].wfrecon__Status__c = 'Pending';
        jobs[2].wfrecon__Total_Contract_Price__c = 75000;
        update jobs;
        
        Test.startTest();
        Map<String, JobMetricsController.MetricData> metrics = JobMetricsController.getJobMetrics();
        Test.stopTest();
        
        System.assertNotEquals(null, metrics, 'Metrics should not be null');
        
    }

    @IsTest
    static void testGetMetricSettings() {
        Test.startTest();
        Map<String, Object> settings = JobMetricsController.getMetricSettings();
        Test.stopTest();

        // Verify status options
        List<Map<String, String>> statusOptions = (List<Map<String, String>>)settings.get('statusOptions');
        System.assert(!statusOptions.isEmpty(), 'Should have status options from picklist');

        // Verify metric status map
        Map<String, List<String>> metricStatusMap = (Map<String, List<String>>)settings.get('metricStatusMap');
        System.assert(metricStatusMap.containsKey('backlog'), 'Should contain backlog mapping');
    }

    @IsTest
    static void testSaveMetricSettings() {
        // Create test metric settings
        Map<String, List<String>> testMetricStatusMap = new Map<String, List<String>>{
            'backlog' => new List<String>{'Not Started', 'On Hold'},
            'inProgress' => new List<String>{'In Progress', 'Pending Review'},
            'openBalance' => new List<String>{'In Progress', 'Completed'},
            'retainagePending' => new List<String>{'Completed'},
            'workRemaining' => new List<String>{'Not Started', 'In Progress'}
        };

        Test.startTest();
        try {
            JobMetricsController.saveMetricSettings(testMetricStatusMap);
            System.assert(true, 'Save operation should complete without exception');
        } catch (Exception e) {
            System.assert(false, 'Should not throw exception: ' + e.getMessage());
        }
        Test.stopTest();
    }

   @IsTest
    static void testGetAllJobsWithScopeData_RecentlyViewedFilter() {
        // First, create test data
        List<wfrecon__Job__c> testJobs = new List<wfrecon__Job__c>{
            new wfrecon__Job__c(
                wfrecon__Job_Name__c = 'Job for Recently Viewed Test',
                wfrecon__Status__c = 'In Progress'
            )
        };
        insert testJobs;
        
        Test.startTest();
        List<JobMetricsController.JobData> jobDataWithFilter = JobMetricsController.getAllJobsWithScopeData(true);
      
        List<JobMetricsController.JobData> jobDataWithoutFilter = JobMetricsController.getAllJobsWithScopeData(false);
        Test.stopTest();
        
        System.assertNotEquals(null, jobDataWithFilter, 'Should return list (possibly empty)');    
        System.assert(jobDataWithoutFilter.size() >= 1, 'Should return jobs when not filtering by recently viewed');
    }
    
    @IsTest
    static void testJobDataWrapperClass() {
        // Test the wrapper class constructor and default values
        JobMetricsController.JobData jobData = new JobMetricsController.JobData();
        
        System.assertEquals(null, jobData.jobId, 'Job ID should be null by default');
        System.assertEquals(null, jobData.jobName, 'Job name should be null by default');
    }

    @IsTest
    static void testMetricDataWrapperClass() {
        JobMetricsController.MetricData metricData = new JobMetricsController.MetricData();
        
        // Test setting values
        metricData.count = 5;
        metricData.totalValue = 100000.50;
        
        System.assertEquals(5, metricData.count, 'Count should be set correctly');
        System.assertEquals(100000.50, metricData.totalValue, 'Total value should be set correctly');
    }

}