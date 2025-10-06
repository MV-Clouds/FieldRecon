@IsTest
public class JobDetailsPageControllerTest {

    // Utility method to create test Job
    private static Job__c createJob(String name) {
        Job__c job = new Job__c(Job_Name__c = name, Description__c = 'Test Description');
        insert job;
        return job;
    }

    // Utility method to create Mobilization
    private static Mobilization__c createMobilization(Job__c job, Date startDate, Date endDate, String status) {

        Mobilization_Group__c mobGroup = new Mobilization_Group__c(
            Start_Date__c = startDate, 
            End_Date__c = endDate, 
            Job__c = job.Id, 
            Mobilization_Status__c = status
        );
        insert mobGroup;
        
        Mobilization__c mob = new Mobilization__c(
            Job__c = job.Id,
            Start_Date__c = startDate,
            End_Date__c = endDate,
            Mobilization_Group__c = mobGroup.Id,
            Mobilization_Status__c = status
        );
        insert mob;
        return mob;
    }

    // Utility method to create Mobilization Member
    private static Mobilization_Member__c createMobilizationMember(Mobilization__c mob, Contact contact) {
        Mobilization_Member__c member = new Mobilization_Member__c(
            Mobilization__c = mob.Id,
            Contact__c = contact.Id
        );
        insert member;
        return member;
    }

    // Utility method to create Contact
    private static Contact createContact(String name, String recordTypeDevName) {
        RecordType rt = [SELECT Id FROM RecordType WHERE DeveloperName = :recordTypeDevName AND SObjectType='Contact' LIMIT 1];
        Contact c = new Contact(FirstName = name, LastName='Test', RecordTypeId = rt.Id, Can_Clock_In_Out__c = true);
        insert c;
        return c;
    }

    // Utility method to create Timesheet
    private static Timesheet__c createTimesheet(Contact contact, Job__c job, Date startDate, Date endDate) {
        Timesheet__c ts = new Timesheet__c(Contact__c = contact.Id, Job__c = job.Id, Timesheet_Start_Date__c = startDate, Timesheet_End_Date__c = endDate, Do_Not_Execute__c = true);
        insert ts;
        return ts;
    }

    // Utility method to create Timesheet Entry
    private static Timesheet_Entry__c createTimesheetEntry(Timesheet__c ts, Datetime clockIn, Datetime clockOut) {
        Timesheet_Entry__c entry = new Timesheet_Entry__c(Timesheet__c = ts.Id, Clock_In_Time__c = clockIn, Clock_Out_Time__c = clockOut);
        insert entry;
        return entry;
    }

    @TestSetup
    static void setupTestData() {
        // Create Jobs, Contacts, Mobilizations
        Job__c job1 = createJob('Job 1');
        Job__c job2 = createJob('Job 2');

        Contact emp = createContact('Employee1', 'Employee_WF_Recon');
        Contact sub = createContact('Subcontractor1', 'Sub_Contractor_WF_Recon');

        Mobilization__c mob1 = createMobilization(job1, Date.today(), Date.today().addDays(1), 'Confirmed');
        Mobilization__c mob2 = createMobilization(job2, Date.today().addDays(-3), Date.today().addDays(-2), 'Confirmed');

        createMobilizationMember(mob1, emp);
        createMobilizationMember(mob2, sub);

        Timesheet__c ts = createTimesheet(createContact('Employee2', 'Employee_WF_Recon'), job1, Date.today(), Date.today());
        Timesheet_Entry__c entry = createTimesheetEntry(ts, Datetime.newInstance(Date.today(), Time.newInstance(9, 0, 0, 0)), Datetime.newInstance(Date.today(), Time.newInstance(17, 0, 0, 0)));
    }
    
    // Test getJobRelatedMoblizationDetails for daily mode
    @IsTest
    static void testGetJobRelatedMoblizationDetails_DayMode() {
        Date filterDate = Date.today();
        Test.startTest();
        List<JobDetailsPageController.MobilizationWrapper> wrappers = JobDetailsPageController.getJobRelatedMoblizationDetails(filterDate, 'day');
        Test.stopTest();
    }

    // Test getJobRelatedMoblizationDetails for week mode
    @IsTest
    static void testGetJobRelatedMoblizationDetails_WeekMode() {
        Date filterDate = Date.today();
        Test.startTest();
        System.debug('Filter Date for Week Mode: ' + filterDate);
        List<JobDetailsPageController.MobilizationWrapper> wrappers = JobDetailsPageController.getJobRelatedMoblizationDetails(filterDate, 'week');
        Test.stopTest();
    }

    // Test getTimeSheetEntryItems
    @IsTest
    static void testGetTimeSheetEntryItems() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Mobilization__c mob = createMobilization(job, Date.today(), Date.today().addDays(1), 'Confirmed');

        Test.startTest();
        List<JobDetailsPageController.TimesheetEntryItemWrapper> items = JobDetailsPageController.getTimeSheetEntryItems(job.Id, mob.Start_Date__c.format('yyyy-MM-dd'));
        Test.stopTest();
    }

    // Test getMobilizationMembersWithStatus with no Timesheet
    @IsTest
    static void testGetMobilizationMembersWithStatus_NoTimesheet() {
        Mobilization__c mob = [SELECT Id FROM Mobilization__c LIMIT 1];
        Test.startTest();
        Map<String, List<JobDetailsPageController.WrapperMember>> members = JobDetailsPageController.getMobilizationMembersWithStatus(mob.Id);
        Test.stopTest();
    }

    // Test createTimesheetRecords for clockIn with first clockin
    @IsTest
    static void testCreateTimesheetRecords_ClockInFirst() {
        Mobilization_Member__c member = [SELECT Id, Contact__c, Mobilization__r.Mobilization_Group__r.Start_Date__c, Mobilization__r.Mobilization_Group__r.End_Date__c, Mobilization__r.Job__c FROM Mobilization_Member__c LIMIT 1];
        // Today's date
        Date today = Date.today();

        // Define desired times
        Time clockOutTime = Time.newInstance(12, 0, 0, 0);  // 12:00 PM
        Time clockInTime  = clockOutTime.addHours(-2);       // 2 hours earlier → 10:00 AM

        // Create Datetime instances
        Datetime clockOutDt = Datetime.newInstance(today, clockOutTime);
        Datetime clockInDt  = Datetime.newInstance(today, clockInTime);

        // Format as string yyyy-MM-dd'T'HH:mm
        String clockInStr  = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        String clockOutStr = clockOutDt.format('yyyy-MM-dd\'T\'HH:mm');
        String params = JSON.serialize(new Map<String, Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockIn',
            'isTimeSheetNull' => true,
            'clockInTime' => clockInStr,
            'jobId' => member.Mobilization__r.Job__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockInTwo() {
        Timesheet__c ts = createTimesheet([SELECT Id FROM Contact LIMIT 1][0], [SELECT Id FROM Job__c LIMIT 1][0], Date.today(), Date.today());
        // Today's date
        Date today = Date.today();

        // Define desired times
        Time clockOutTime = Time.newInstance(12, 0, 0, 0);  // 12:00 PM
        Time clockInTime  = clockOutTime.addHours(-2);       // 2 hours earlier → 10:00 AM

        // Create Datetime instances
        Datetime clockInDt  = Datetime.newInstance(today, clockInTime);

        // Format as string yyyy-MM-dd'T'HH:mm
        String clockInStr  = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        String params = JSON.serialize(new Map<String, Object>{
            'actionType' => 'clockIn',
            'isTimeSheetNull' => true,
            'timesheetId' => ts.Id,
            'clockInTime' => clockInStr,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    // Test createTimesheetRecords for clockOut with existing timesheet entry
    @IsTest
    static void testCreateTimesheetRecords_ClockOutExistingEntry() {
        Mobilization_Member__c member = [SELECT Id, Contact__c, Mobilization__r.Mobilization_Group__r.Start_Date__c, Mobilization__r.Mobilization_Group__r.End_Date__c, Mobilization__r.Job__c FROM Mobilization_Member__c LIMIT 1];
        Timesheet__c ts = createTimesheet([SELECT Id FROM Contact LIMIT 1][0], [SELECT Id FROM Job__c LIMIT 1][0], Date.today(), Date.today());
        Timesheet_Entry__c entry = createTimesheetEntry(ts, Datetime.newInstance(Date.today(), Time.newInstance(12, 0, 0, 0)), null);
        // Today's date
        Date today = Date.today();

        // Define desired times
        Time clockOutTime = Time.newInstance(12, 0, 0, 0);  // 12:00 PM
        Time clockInTime  = clockOutTime.addHours(-2);       // 2 hours earlier → 10:00 AM

        // Create Datetime instances
        Datetime clockOutDt = Datetime.newInstance(today, clockOutTime);
        Datetime clockInDt  = Datetime.newInstance(today, clockInTime);

        // Format as string yyyy-MM-dd'T'HH:mm
        String clockInStr  = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        String clockOutStr = clockOutDt.format('yyyy-MM-dd\'T\'HH:mm');
        String params = JSON.serialize(new Map<String, Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => false,
            'timesheetId' => ts.Id,
            'timesheetEntryId' => entry.Id,
            'clockInTime' => clockInStr,
            'clockOutTime' => clockOutStr,
            'jobId' => member.Mobilization__r.Job__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    @IsTest
    static void testCreateTimesheetRecords_ClockOutNewEntry() {
        Mobilization_Member__c member = [SELECT Id, Contact__c, Mobilization__r.Mobilization_Group__r.Start_Date__c, Mobilization__r.Mobilization_Group__r.End_Date__c, Mobilization__r.Job__c FROM Mobilization_Member__c LIMIT 1];
        Timesheet__c ts = createTimesheet([SELECT Id FROM Contact LIMIT 1][0], [SELECT Id FROM Job__c LIMIT 1][0], Date.today(), Date.today());
        Timesheet_Entry__c entry = createTimesheetEntry(ts, Datetime.newInstance(Date.today(), Time.newInstance(12, 0, 0, 0)), null);
        // Today's date
        Date today = Date.today();

        // Define desired times
        Time clockOutTime = Time.newInstance(12, 0, 0, 0);  // 12:00 PM
        Time clockInTime  = clockOutTime.addHours(-2);       // 2 hours earlier → 10:00 AM

        // Create Datetime instances
        Datetime clockOutDt = Datetime.newInstance(today, clockOutTime);
        Datetime clockInDt  = Datetime.newInstance(today, clockInTime);

        // Format as string yyyy-MM-dd'T'HH:mm
        String clockInStr  = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        String clockOutStr = clockOutDt.format('yyyy-MM-dd\'T\'HH:mm');
        String params = JSON.serialize(new Map<String, Object>{
            'mobMemberId' => member.Id,
            'actionType' => 'clockOut',
            'isTimeSheetNull' => false,
            'isTimeSheetEntryNull' => true,
            'timesheetId' => ts.Id,
            'clockInTime' => String.valueOf(clockInDt),
            'clockOutTime' => clockOutStr,
            'jobId' => member.Mobilization__r.Job__c,
            'costCodeId' => null
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createTimesheetRecords(params);
        Test.stopTest();
    }

    // Test createManualTimesheetRecords
    @IsTest
    static void testCreateManualTimesheetRecords() {
        Job__c job = createJob('Job 1');
        Mobilization__c mob = createMobilization(job, Date.today(), Date.today(), 'Confirmed');
        Contact contact = createContact('Employee1', 'Employee_WF_Recon');

        // Today's date
        Date today = Date.today();

        // Define desired times
        Time clockOutTime = Time.newInstance(12, 0, 0, 0);  // 12:00 PM
        Time clockInTime  = clockOutTime.addHours(-2);       // 2 hours earlier → 10:00 AM

        // Create Datetime instances
        Datetime clockOutDt = Datetime.newInstance(today, clockOutTime);
        Datetime clockInDt  = Datetime.newInstance(today, clockInTime);
        Datetime startEnd  = Datetime.newInstance(today, clockInTime);

        // Format as string yyyy-MM-dd'T'HH:mm
        String clockInStr  = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        String clockOutStr = clockOutDt.format('yyyy-MM-dd\'T\'HH:mm');
        String startEndStr = startEnd.format('yyyy-MM-dd\'T\'HH:mm');

        String params = JSON.serialize(new Map<String, Object>{
            'contactId' => contact.Id,
            'jobId' => job.Id,
            'mobId' => mob.Id,
            'costCodeId' => null,
            'jobStartDate' => startEndStr,
            'jobEndDate' => startEndStr,
            'clockInTime' => clockInStr,
            'clockOutTime' => clockOutStr,
            'travelTime' => '1.5',
            'perDiem' => '1'
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.createManualTimesheetRecords(params);
        Test.stopTest();
    }

    // Test updateTimesheets
    @IsTest
    static void testUpdateTimesheets() {
        Timesheet__c ts = createTimesheet([SELECT Id FROM Contact LIMIT 1][0], [SELECT Id FROM Job__c LIMIT 1][0], Date.today(), Date.today());
        Timesheet_Entry__c entry = createTimesheetEntry([SELECT Id FROM Timesheet__c LIMIT 1][0], Datetime.newInstance(Date.today(), Time.newInstance(12, 0, 0, 0)), Datetime.newInstance(Date.today(), Time.newInstance(12, 0, 0, 0)));
        Timesheet_Entry_Item__c item = new Timesheet_Entry_Item__c(Timesheet_Entry__c = entry.Id, Clock_In_Time__c = entry.Clock_In_Time__c, Clock_Out_Time__c = entry.Clock_Out_Time__c);
        insert item;

        // Today's date
        Date today = Date.today();

        // Define desired times
        Time clockOutTime = Time.newInstance(12, 0, 0, 0);  // 12:00 PM
        Time clockInTime  = clockOutTime.addHours(-2);       // 2 hours earlier → 10:00 AM

        // Create Datetime instances
        Datetime clockOutDt = Datetime.newInstance(today, clockOutTime);
        Datetime clockInDt  = Datetime.newInstance(today, clockInTime);

        // Format as string yyyy-MM-dd'T'HH:mm
        String clockInStr  = clockInDt.format('yyyy-MM-dd\'T\'HH:mm');
        String clockOutStr = clockOutDt.format('yyyy-MM-dd\'T\'HH:mm');

        String params = JSON.serialize(new Map<String, Object>{
            'Id' => item.Id,
            'TSEId' => entry.Id,
            'ClockIn' => clockInStr,
            'ClockOut' => clockOutStr,
            'TravelTime' => '2.5',
            'PerDiem' => '1'
        });

        Test.startTest();
        Boolean res = JobDetailsPageController.updateTimesheets(params);
        Test.stopTest();
    }

    // Test getContactsAndCostcode
    @IsTest
    static void testGetContactsAndCostcode() {
        Test.startTest();
        Map<String, Object> res = JobDetailsPageController.getContactsAndCostcode();
        Test.stopTest();
    }

    // Test convertUtc & convertUtcToUserTz
    @IsTest
    static void testConvertUtcMethods() {
        Test.startTest();
        Datetime dt1 = JobDetailsPageController.convertUtc('2025-10-05T07:00');
        Test.stopTest();
    }
}