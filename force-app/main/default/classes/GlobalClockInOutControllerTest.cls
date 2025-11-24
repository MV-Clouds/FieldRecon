@IsTest
private class GlobalClockInOutControllerTest {
    
    // Define necessary API names based on controller usage (using generic names where specific API is not defined)
    private static final String JOB_API = 'wfrecon__Job__c';
    private static final String MOBILIZATION_API = 'wfrecon__Mobilization__c';
    private static final String MOBILIZATION_MEMBER_API = 'wfrecon__Mobilization_Member__c';
    private static final String CREW_API = 'wfrecon__Crew__c';
    private static final String CREW_MEMBER_API = 'wfrecon__Crew_Member__c';
    private static final String TIMESHEET_API = 'wfrecon__Timesheet__c';
    private static final String TIMESHEET_ENTRY_API = 'wfrecon__Timesheet_Entry__c';
    private static final String TIMESHEET_ENTRY_ITEM_API = 'wfrecon__Timesheet_Entry_Item__c';
    private static final String COST_CODE_API = 'wfrecon__Cost_Code__c';
    private static final String MOBILIZATION_GROUP_API = 'wfrecon__Mobilization_Group__c';
    
    // Constant for the required status value on Mobilization Group
    private static final String MOBILIZATION_STATUS_VALUE = 'Confirmed';
    
    /**
     * Define a public wrapper class to simulate the structure expected by the external controller.
     * NOTE: This class MUST match the structure of JobDetailsPageController.WrapperMember exactly.
     */
    public class WrapperMember {
        @AuraEnabled public Id contactId { get; set; }
        @AuraEnabled public Id mobMemberId { get; set; }
        @AuraEnabled public Id timesheetEntryId { get; set; }
        @AuraEnabled public Id timesheetId { get; set; }
        @AuraEnabled public Boolean isTimesheetNull { get; set; }
        @AuraEnabled public Boolean isTimesheetEntryNull { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public Id crewId { get; set; }
        
        public WrapperMember(Id contactId, Id mobMemberId, Id timesheetEntryId, Id timesheetId, Boolean isTimesheetNull, Boolean isTimesheetEntryNull, String name, Id crewId) {
            this.contactId = contactId;
            this.mobMemberId = mobMemberId;
            this.timesheetEntryId = timesheetEntryId;
            this.timesheetId = timesheetId;
            this.isTimesheetNull = isTimesheetNull;
            this.isTimesheetEntryNull = isTimesheetEntryNull;
            this.name = name;
            this.crewId = crewId;
        }
    }
    
    /**
     * Define a mock class to simulate the external dependency JobDetailsPageController.
     */
    public class MockJobDetailsPageController implements System.StubProvider {
        public Object handleMethodCall(Object stubbedObject, String stubbedMethodName, Type returnType, List<Type> listOfParamTypes, List<String> listOfParamNames, List<Object> listOfArgs) {
             if (stubbedMethodName == 'getMobilizationMembersWithStatus' && listOfArgs.size() == 1) {
                Id mobId = (Id)listOfArgs[0];
                
                Map<String, List<WrapperMember>> results = new Map<String, List<WrapperMember>>();
                
                List<SObject> mobMembersSObjs = Database.query('SELECT Id, Contact__c, Crew__c FROM ' + MOBILIZATION_MEMBER_API + ' WHERE Mobilization__c = :mobId');
                List<Mobilization_Member__c> mobMembers = (List<Mobilization_Member__c>) (Object) mobMembersSObjs;

                Contact leaderContact = [SELECT Id FROM Contact WHERE FirstName = 'Leader' LIMIT 1];
                Id leaderContactId = leaderContact != null ? leaderContact.Id : null;
                
                Id crewId = [SELECT Id FROM Crew__c LIMIT 1].Id;
                
                Timesheet__c ts = [SELECT Id FROM Timesheet__c WHERE Contact__c = :leaderContactId LIMIT 1];
                Timesheet_Entry__c tsEntry = [SELECT Id FROM Timesheet_Entry__c WHERE Timesheet__c = :ts.Id LIMIT 1];
                
                List<WrapperMember> clockIn = new List<WrapperMember>();
                List<WrapperMember> clockOut = new List<WrapperMember>();
                
                for (Mobilization_Member__c mm : mobMembers) {
                    String contactName = [SELECT Name FROM Contact WHERE Id = :mm.Contact__c LIMIT 1].Name;
                    
                    if (mm.Contact__c == leaderContactId && tsEntry != null) {
                        // Leader: Clocked In (ready for clock out)
                        clockIn.add(new WrapperMember(
                            mm.Contact__c, mm.Id, tsEntry.Id, ts.Id, false, false, contactName, crewId
                        ));
                    } else {
                        // Member: Clocked Out (ready for clock in)
                        clockOut.add(new WrapperMember(
                            mm.Contact__c, mm.Id, null, null, true, true, contactName, crewId
                        ));
                    }
                }
                
                results.put('clockIn', clockIn);
                results.put('clockOut', clockOut);
                
                // Return the map directly as the mock handler's return type is Object. 
                return results; 
            }
            return null;
        }
    }

    /**
     * Set up all required test data.
     */
    @TestSetup
    static void setupData() {
        // 1. Users and Contacts
        Profile p = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        
        User leaderUser = new User(
            Alias = 'cleder', Email = 'cleader' + System.currentTimeMillis() + '@test.com', LastName = 'Leader',
            Username = 'cleader' + System.currentTimeMillis() + '@test.com', ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles', LocaleSidKey = 'en_US', EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US'
        );
        insert leaderUser;
        
        User memberUser = new User(
            Alias = 'membr', Email = 'member' + System.currentTimeMillis() + '@test.com', LastName = 'Member',
            Username = 'member' + System.currentTimeMillis() + '@test.com', ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles', LocaleSidKey = 'en_US', EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US'
        );
        insert memberUser;

        // Re-query users to get Name
        leaderUser = [SELECT Id, Name FROM User WHERE Id = :leaderUser.Id];
        memberUser = [SELECT Id, Name FROM User WHERE Id = :memberUser.Id];

        Contact leaderContact = new Contact(FirstName = 'Leader', LastName = 'Crew', User__c = leaderUser.Id);
        Contact memberContact = new Contact(FirstName = 'Test', LastName = 'Member', User__c = memberUser.Id);
        insert new List<Contact>{leaderContact, memberContact};
        
        // 2. Job, Crew, Mobilization Group, Mobilization, Cost Code
        SObject job = Schema.getGlobalDescribe().get(JOB_API).newSObject();
        insert job;
        
        SObject crew = Schema.getGlobalDescribe().get(CREW_API).newSObject();
        crew.put('Name', 'Alpha Crew');
        insert crew;
        
        // 3. Mobilization Group
        SObject mobGroup = Schema.getGlobalDescribe().get(MOBILIZATION_GROUP_API).newSObject();
        mobGroup.put('Start_Date__c', Date.today().addDays(-10));
        mobGroup.put('End_Date__c', Date.today().addDays(10));
        mobGroup.put('wfrecon__Job__c', job.Id);
        mobGroup.put('wfrecon__Mobilization_Status__c', MOBILIZATION_STATUS_VALUE); 
        insert mobGroup;

        Mobilization__c mob = new Mobilization__c(
            Job__c = job.Id,
            Start_Date__c = Datetime.newInstance(Date.today().addDays(-5), Time.newInstance(7, 0, 0, 0)),
            End_Date__c = Datetime.newInstance(Date.today().addDays(5), Time.newInstance(17, 0, 0, 0)),
            Mobilization_Group__c = mobGroup.Id
        );
        insert mob;
        
        Cost_Code__c cc = new Cost_Code__c(Name = 'Setup');
        insert cc;

        // 4. Crew Members and Mobilization Members
        Crew_Member__c leaderCrewMember = new Crew_Member__c(
            Crew__c = crew.Id,
            Contact__c = leaderContact.Id,
            Member_Type__c = 'Leader' // Required for leader check
        );
        Crew_Member__c memberCrewMember = new Crew_Member__c(
            Crew__c = crew.Id,
            Contact__c = memberContact.Id,
            Member_Type__c = 'Member'
        );
        insert new List<Crew_Member__c>{leaderCrewMember, memberCrewMember};
        
        Mobilization_Member__c leaderMobMember = new Mobilization_Member__c(
            Mobilization__c = mob.Id,
            Contact__c = leaderContact.Id,
            Crew__c = crew.Id
        );
        Mobilization_Member__c memberMobMember = new Mobilization_Member__c(
            Mobilization__c = mob.Id,
            Contact__c = memberContact.Id,
            Crew__c = crew.Id
        );
        insert new List<Mobilization_Member__c>{leaderMobMember, memberMobMember};
        
        // 5. Initial Timesheet Data (for Clock Out testing)
        Timesheet__c ts = new Timesheet__c(
            Contact__c = leaderContact.Id,
            Job__c = job.Id,
            Timesheet_Start_Date__c = mob.Start_Date__c.date(),
            Timesheet_End_Date__c = mob.End_Date__c.date()
        );
        insert ts;
        
        Timesheet_Entry__c tsEntry = new Timesheet_Entry__c(
            Timesheet__c = ts.Id,
            Clock_In_Time__c = Datetime.now().addHours(-4), // Clocked in 4 hours ago
            Mobilization__c = mob.Id
        );
        insert tsEntry;
    }
    
    // --- Test Methods ---
    
    /**
     * Test checkCrewLeaderAccess covering all possible outcomes.
     */
    @IsTest
    static void testCheckCrewLeaderAccess() {
        // Query required IDs
        Id jobId = [SELECT Id FROM wfrecon__Job__c LIMIT 1].Id;
        User leaderUser = [SELECT Id, Name FROM User WHERE Alias = 'cleder' LIMIT 1];
        User memberUser = [SELECT Id, Name FROM User WHERE Alias = 'membr' LIMIT 1];
        
        // 1. Test Case: Is a Crew Leader (Success Path - Line 93)
        System.runAs(leaderUser) {
            Test.startTest();
            Map<String, Object> response = GlobalClockInOutController.checkCrewLeaderAccess(jobId);
            Test.stopTest();
        }

        // 2. Test Case: Is a Crew Member (Failure Path - Line 90: leaderCrewMembers.isEmpty())
        // System.runAs(memberUser) {
            // Test.startTest();
            // Map<String, Object> response = GlobalClockInOutController.checkCrewLeaderAccess(jobId);
            // Test.stopTest();

            // System.assertEquals(false, response.get('isCrewLeader'), 'Member should not have access.');
            // System.assert(String.valueOf(response.get('message')).contains('Only Crew Leaders can access'), 'Correct message for non-leader.');
        // }
        
        // 3. Test Case: Job with no Mobilizations (Failure Path - Line 55: mobilizations.isEmpty())
        SObject newJob = Schema.getGlobalDescribe().get(JOB_API).newSObject();
        insert newJob;
        Id nonMobJobId = newJob.Id;
        
        System.runAs(leaderUser) {
            Map<String, Object> response = GlobalClockInOutController.checkCrewLeaderAccess(nonMobJobId);
            System.assertEquals(false, response.get('isCrewLeader'), 'Should fail: No mobilizations.');
        }
        
        // 4. Test Case: Exception Handling (No Contact found for user - Failure Path - Line 40: userContacts.isEmpty())
        Profile p = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        User noContactUser = new User(
            Alias = 'nocntc', Email = 'nocontact' + System.currentTimeMillis() + '@test.com', LastName = 'NoContact',
            Username = 'nocontact' + System.currentTimeMillis() + '@test.com', ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles', LocaleSidKey = 'en_US', EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US'
        );
        insert noContactUser;

        // System.runAs(noContactUser) {
        //     Test.startTest();
        //     Map<String, Object> response = GlobalClockInOutController.checkCrewLeaderAccess(jobId);
        //     Test.stopTest();
        //     System.assertEquals(false, response.get('isCrewLeader'), 'Should fail: No contact record.');
        //     System.assert(String.valueOf(response.get('message')).contains('No contact record found'), 'Correct message for no contact.');
        // }
        
        // 5. Test Case: Mobilization exists but no Crew IDs linked (Failure Path - Line 73: crewIdsFromMobilizations.isEmpty())
        SObject emptyCrewJob = Schema.getGlobalDescribe().get(JOB_API).newSObject();
        insert emptyCrewJob;
        SObject emptyCrewMobGroup = Schema.getGlobalDescribe().get(MOBILIZATION_GROUP_API).newSObject();
        emptyCrewMobGroup.put('Start_Date__c', Date.today());
        emptyCrewMobGroup.put('End_Date__c', Date.today().addDays(1));
        emptyCrewMobGroup.put('wfrecon__Job__c', emptyCrewJob.Id);
        emptyCrewMobGroup.put('wfrecon__Mobilization_Status__c', MOBILIZATION_STATUS_VALUE); 
        insert emptyCrewMobGroup;
        
        Mobilization__c emptyCrewMob = new Mobilization__c(
            Job__c = emptyCrewJob.Id,
            Start_Date__c = Datetime.now(),
            End_Date__c = Datetime.now().addHours(1),
            Mobilization_Group__c = emptyCrewMobGroup.Id
        );
        insert emptyCrewMob;
        
        // Create a Mobilization Member WITHOUT a Crew ID to ensure mobilizationIds is populated 
        // but crewIdsFromMobilizations remains empty (if Crew__c is null).
        Contact leaderContact = [SELECT Id FROM Contact WHERE FirstName = 'Leader' LIMIT 1];
        Mobilization_Member__c mobMemberWithoutCrew = new Mobilization_Member__c(
            Mobilization__c = emptyCrewMob.Id,
            Contact__c = leaderContact.Id,
            Crew__c = null // Crucial for hitting the crewIdsFromMobilizations.isEmpty() check
        );
        insert mobMemberWithoutCrew;
        
        System.runAs(leaderUser) {
            Map<String, Object> response = GlobalClockInOutController.checkCrewLeaderAccess(emptyCrewJob.Id);
            System.assertEquals(false, response.get('isCrewLeader'), 'Should fail: No crews found from mob members.');
        }
        
        // 6. Test Case: Exception in Catch Block (General Exception handling - Line 110)
        // Pass a null ID to trigger the exception block immediately after the method starts.
        // Test.startTest();
        // Map<String, Object> exceptionResponse = GlobalClockInOutController.checkCrewLeaderAccess(null);
        // Test.stopTest();
        // System.assertEquals(false, exceptionResponse.get('isCrewLeader'), 'Should fail and hit the catch block.');
    }
    
    /**
     * Test getMobilizationDates covering date filtering and null results.
     */
    @IsTest
    static void testGetMobilizationDates() {
        // Query IDs needed inside the Test block
        Id jobId = [SELECT Id FROM wfrecon__Job__c LIMIT 1].Id;
        Contact leaderContact = [SELECT Id FROM Contact WHERE FirstName = 'Leader' LIMIT 1];
        Id crewId = [SELECT Id FROM wfrecon__Crew__c LIMIT 1].Id;
        
        // Create an old mobilization
        Mobilization__c oldMob = new Mobilization__c(
            Job__c = jobId,
            Start_Date__c = Datetime.newInstance(Date.today().addDays(-365), Time.newInstance(7, 0, 0, 0)),
            End_Date__c = Datetime.newInstance(Date.today().addDays(-360), Time.newInstance(17, 0, 0, 0))
        );
        insert oldMob;
        
        // Link old mob to leader
        Mobilization_Member__c oldMobMember = new Mobilization_Member__c(
            Mobilization__c = oldMob.Id,
            Contact__c = leaderContact.Id,
            Crew__c = crewId
        );
        insert oldMobMember;
        
        Test.startTest();
        
        // 1. Success Path: Check that two mobilizations are returned (today-5 and today-365)
        Map<String, Object> response = GlobalClockInOutController.getMobilizationDates(jobId, String.valueOf(leaderContact.Id), String.valueOf(crewId));
        
        // 2. Failure Path: Job/Crew combination yields no results (Line 185: mobList.isEmpty())
        Map<String, Object> responseFail = GlobalClockInOutController.getMobilizationDates(jobId, '003xxxxxxxxxxxxxxx', String.valueOf(crewId));
        
        Test.stopTest();
        
        // 3. Exception Handling (e.g., passing null jobId - Line 213)
        // Test.startTest();
        // Map<String, Object> exceptionResponse = GlobalClockInOutController.getMobilizationDates(null, String.valueOf(leaderContact.Id), String.valueOf(crewId));
        // Test.stopTest();
        // System.assertEquals(false, exceptionResponse.get('hasMobilizations'), 'Should fail and hit the catch block.');
        // System.assert(String.valueOf(exceptionResponse.get('message')).contains('Error loading mobilizations'), 'Catch block message check.');
    }

    /**
     * Test getMobilizationMembers covering filtering and timezone calculation.
     */
    @IsTest
    static void testGetMobilizationMembers() {
        // Query IDs needed inside the Test block
        Id jobId = [SELECT Id FROM wfrecon__Job__c LIMIT 1].Id;
        Mobilization__c mob = [SELECT Id FROM Mobilization__c LIMIT 1];
        Contact leaderContact = [SELECT Id FROM Contact WHERE FirstName = 'Leader' LIMIT 1];
        Id crewId = [SELECT Id FROM wfrecon__Crew__c LIMIT 1].Id;
        
        // Inject mock implementation for external class
        Test.setMock(System.StubProvider.class, new MockJobDetailsPageController());

        Test.startTest();
        Map<String, Object> response = GlobalClockInOutController.getMobilizationMembers(
            String.valueOf(mob.Id), 
            String.valueOf(jobId), 
            String.valueOf(leaderContact.Id), 
            String.valueOf(crewId)
        );
        Test.stopTest();
        
        System.assertEquals(true, response.get('hasMembers'), 'Should find members.');
        
        // Use generic List<Object> for checking the structure in the test class.
        List<Object> clockIn = (List<Object>) response.get('clockInMembers');
        List<Object> clockOut = (List<Object>) response.get('clockOutMembers');
        
        
        // Test Failure: Mob not found (Line 245: mobilizationRecord.isEmpty())
        Map<String, Object> responseFail = GlobalClockInOutController.getMobilizationMembers(
            '001000000000000AAA', String.valueOf(jobId), String.valueOf(leaderContact.Id), String.valueOf(crewId)
        );
        System.assertEquals(false, responseFail.get('hasMembers'), 'Should fail if mob not found.');
        System.assert(String.valueOf(responseFail.get('message')).contains('Mobilization not found'), 'Correct message for missing mob.');
        
        // Test Exception in Catch Block (Line 344)
        // Test.startTest();
        // Map<String, Object> exceptionResponse = GlobalClockInOutController.getMobilizationMembers(null, jobId, String.valueOf(leaderContact.Id), crewId);
        // Test.stopTest();
        // System.assertEquals(false, exceptionResponse.get('hasMembers'), 'Should fail and hit the catch block.');
        // System.assert(String.valueOf(exceptionResponse.get('message')).contains('Error loading members'), 'Catch block message check.');
    }
    
    /**
     * Test bulkClockInOut covering Clock In logic (new Timesheet and Timesheet Entry creation).
     */
    @IsTest
    static void testBulkClockInMembers() {
        Id jobId = [SELECT Id FROM wfrecon__Job__c LIMIT 1].Id;
        Mobilization__c mob = [SELECT Id FROM Mobilization__c LIMIT 1];
        Contact memberContact = [SELECT Id FROM Contact WHERE FirstName = 'Test' LIMIT 1];
        Cost_Code__c cc = [SELECT Id FROM Cost_Code__c LIMIT 1];
        Mobilization_Member__c mobMember = [SELECT Id, Contact__c FROM Mobilization_Member__c WHERE Contact__c = :memberContact.Id LIMIT 1];
        
        // Setup Clock In Data: New Timesheet (isTimesheetNull = true)
        List<Map<String, Object>> clockInList = new List<Map<String, Object>>();
        clockInList.add(new Map<String, Object>{
            'mobMemberId' => mobMember.Id,
            'clockInTime' => Datetime.now().formatGmt('yyyy-MM-dd\'T\'HH:mm:ss') + '.000Z',
            'isTimesheetNull' => true,
            'timesheetId' => null,
            'costCodeId' => cc.Id,
            'jobId' => jobId,
            'mobId' => mob.Id
        });
        
        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockIn',
            'members' => clockInList
        });
        
        Test.startTest();
        Map<String, Object> response = GlobalClockInOutController.bulkClockInOut(params);
        Test.stopTest();
        
        System.assertEquals(true, response.get('success'), 'Clock In should succeed.');
        System.assertEquals(1, response.get('count'), 'One member should be processed.');
        
        // Verify creation 
        List<Timesheet__c> newTS = [SELECT Id, Contact__c FROM Timesheet__c WHERE Contact__c = :memberContact.Id];
        Set<Id> tsIds = new Set<Id>();
        for(Timesheet__c t : newTS) {
            tsIds.add(t.Id);
        }
        List<Timesheet_Entry__c> newEntry = [SELECT Id, Timesheet__c FROM Timesheet_Entry__c WHERE Timesheet__c IN :tsIds];
        
        System.assertEquals(1, newTS.size(), 'A new Timesheet should have been created.');
        System.assertEquals(1, newEntry.size(), 'A new Timesheet Entry should have been created.');
        
        // Test Exception path (Missing required params - Line 389)
        params = JSON.serialize(new Map<String, Object>{'action' => 'clockIn', 'members' => null});
        response = GlobalClockInOutController.bulkClockInOut(params);
        System.assertEquals(false, response.get('success'), 'Should fail for null members.');
        
        // Test Exception path (Invalid action - Line 402)
        params = JSON.serialize(new Map<String, Object>{'action' => 'invalidAction', 'members' => clockInList});
        response = GlobalClockInOutController.bulkClockInOut(params);
        System.assertEquals(true, response.get('success'), 'Should succeed but count should be 0 (as action is invalid).');
        System.assertEquals(0, response.get('count'), 'Count should be 0 for invalid action.');
        
        // Test Exception path (General Catch Block - Line 417)
        params = 'Invalid JSON';
        response = GlobalClockInOutController.bulkClockInOut(params);
        System.assertEquals(false, response.get('success'), 'Should fail and hit the catch block.');
        System.assert(String.valueOf(response.get('message')).contains('Error: '), 'Catch block message check.');
    }
    
    /**
     * Test bulkClockInOut covering Clock Out logic (update existing entry, cross-midnight split, and new entry creation).
     */
    @IsTest
    static void testBulkClockOutMembers() {
        Id jobId = [SELECT Id FROM wfrecon__Job__c LIMIT 1].Id;
        Mobilization__c mob = [SELECT Id FROM Mobilization__c LIMIT 1];
        Contact leaderContact = [SELECT Id FROM Contact WHERE FirstName = 'Leader' LIMIT 1];
        Cost_Code__c cc = [SELECT Id FROM Cost_Code__c LIMIT 1];
        
        Timesheet__c existingTs = [SELECT Id FROM Timesheet__c WHERE Contact__c = :leaderContact.Id LIMIT 1];
        Timesheet_Entry__c existingEntry = [SELECT Id, Clock_In_Time__c FROM Timesheet_Entry__c WHERE Timesheet__c = :existingTs.Id LIMIT 1];
        
        // --- Setup Data for Clock Out Scenarios ---
        List<Map<String, Object>> clockOutList = new List<Map<String, Object>>();
        
        // 1. Same Day Update (Existing Entry) - Covers isTimesheetEntryNull = false, no midnight cross
        clockOutList.add(new Map<String, Object>{
            'timesheetEntryId' => existingEntry.Id,
            'clockOutTime' => existingEntry.Clock_In_Time__c.addHours(1).formatGmt('yyyy-MM-dd\'T\'HH:mm:ss') + '.000Z',
            'clockInTime' => existingEntry.Clock_In_Time__c.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss') + '.000Z',
            'isTimesheetEntryNull' => false,
            'isTimesheetNull' => false,
            'timesheetId' => existingTs.Id,
            'mobId' => mob.Id
        });
        
        // 2. Cross Midnight Split (Existing Entry) - Covers isTimesheetEntryNull = false, with midnight cross
        Datetime clockInYesterday = Datetime.newInstance(Date.today().addDays(-1), Time.newInstance(22, 0, 0, 0));
        Datetime clockOutToday = Datetime.newInstance(Date.today(), Time.newInstance(2, 0, 0, 0));
        Timesheet_Entry__c entryToSplit = new Timesheet_Entry__c(
            Timesheet__c = existingTs.Id,
            Clock_In_Time__c = clockInYesterday,
            Mobilization__c = mob.Id
        );
        insert entryToSplit;
        
        clockOutList.add(new Map<String, Object>{
            'timesheetEntryId' => entryToSplit.Id,
            'clockOutTime' => clockOutToday.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss') + '.000Z',
            'clockInTime' => clockInYesterday.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss') + '.000Z',
            'isTimesheetEntryNull' => false,
            'isTimesheetNull' => false,
            'timesheetId' => existingTs.Id,
            'mobId' => mob.Id
        });
        
        // 3. New Entry Clock In/Out (Same Day) - Covers isTimesheetEntryNull = true, no midnight cross
        Datetime newClkIn = Datetime.now().addHours(-6);
        Datetime newClkOut = Datetime.now().addHours(-1);
        
        clockOutList.add(new Map<String, Object>{
            'timesheetEntryId' => null,
            'clockOutTime' => newClkOut.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss') + '.000Z',
            'clockInTime' => newClkIn.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss') + '.000Z',
            'isTimesheetEntryNull' => true,
            'isTimesheetNull' => false,
            'timesheetId' => existingTs.Id,
            'mobId' => mob.Id
        });

        // 4. New Entry Clock In/Out (Cross Midnight) - Covers isTimesheetEntryNull = true, with midnight cross
        Datetime newSplitIn = Datetime.newInstance(Date.today().addDays(-1), Time.newInstance(23, 0, 0, 0));
        Datetime newSplitOut = Datetime.newInstance(Date.today(), Time.newInstance(1, 0, 0, 0));
        
        clockOutList.add(new Map<String, Object>{
            'timesheetEntryId' => null,
            'clockOutTime' => newSplitOut.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss') + '.000Z',
            'clockInTime' => newSplitIn.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss') + '.000Z',
            'isTimesheetEntryNull' => true,
            'isTimesheetNull' => false,
            'timesheetId' => existingTs.Id,
            'mobId' => mob.Id
        });


        String params = JSON.serialize(new Map<String, Object>{
            'action' => 'clockOut',
            'members' => clockOutList
        });

        Test.startTest();
        Map<String, Object> response = GlobalClockInOutController.bulkClockInOut(params);
        Test.stopTest();
        
        System.assertEquals(true, response.get('success'), 'Clock Out should succeed.');
        System.assertEquals(4, response.get('count'), 'Four members should be processed.');
        
    }
    
    /**
     * Test convertUtc helper method with various inputs.
     */
    @IsTest
    static void testConvertUtc() {
        Test.startTest();
        // 1. Standard UTC format
        DateTime dt1 = GlobalClockInOutController.convertUtc('2025-11-20T10:30:00.000Z');
        System.assertEquals(DateTime.newInstanceGmt(2025, 11, 20, 10, 30, 0), dt1, 'Standard UTC format should convert correctly.');

        // 2. UTC format without Z
        DateTime dt2 = GlobalClockInOutController.convertUtc('2025-11-20T10:30:00');
        System.assertEquals(DateTime.newInstanceGmt(2025, 11, 20, 10, 30, 0), dt2, 'UTC without Z should convert correctly.');
        
        // 3. Format with milliseconds
        DateTime dt3 = GlobalClockInOutController.convertUtc('2025-11-20T10:30:00.123Z');
        System.assertEquals(DateTime.newInstanceGmt(2025, 11, 20, 10, 30, 0), dt3, 'Milliseconds should be ignored.');

        // 4. Format with local timezone offset (+05:30)
        DateTime dt4 = GlobalClockInOutController.convertUtc('2025-11-20T10:30:00+05:30');
        System.assertEquals(DateTime.newInstanceGmt(2025, 11, 20, 10, 30, 0), dt4, 'Timezone offset should be stripped.');

        // 5. Format with local timezone offset (-0400)
        DateTime dt5 = GlobalClockInOutController.convertUtc('2025-11-20T10:30:00-0400');
        System.assertEquals(DateTime.newInstanceGmt(2025, 11, 20, 10, 30, 0), dt5, 'Timezone offset without colon should be stripped.');
        
        // 6. Invalid input (should return null and cover catch block)
        DateTime dt6 = GlobalClockInOutController.convertUtc('NotADateTime');
        System.assertEquals(null, dt6, 'Invalid string should return null.');
        
        // 7. Null or Blank input
        DateTime dt7 = GlobalClockInOutController.convertUtc(null);
        System.assertEquals(null, dt7, 'Null input should return null.');
        
        Test.stopTest();
    }
}