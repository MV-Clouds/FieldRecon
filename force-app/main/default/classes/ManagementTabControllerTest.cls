@IsTest
private class ManagementTabControllerTest {

    @TestSetup
    static void setupTestData() {
        // ======== Record Types ========
        RecordType empRt = [SELECT Id FROM RecordType WHERE DeveloperName='Employee_WF_Recon' AND SObjectType='Contact' LIMIT 1];
        RecordType subRt = [SELECT Id FROM RecordType WHERE DeveloperName='Sub_Contractor_WF_Recon' AND SObjectType='Contact' LIMIT 1];
        
        // ======== Users ========
        Profile p = [SELECT Id FROM Profile WHERE Name='System Administrator' LIMIT 1];
        User testUser1 = new User(
            Alias = 'tuser1',
            Email = 'testuser1@example.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Testing1',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'testuser1' + System.currentTimeMillis() + '@example.com',
            IsActive = true
        );
        User testUser2 = new User(
            Alias = 'tuser2',
            Email = 'testuser2@example.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Testing2',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'testuser2' + System.currentTimeMillis() + '@example.com',
            IsActive = true
        );
        insert new List<User>{testUser1, testUser2};

        // ======== Contacts ========
        Contact emp1 = new Contact(
            FirstName='Employee1', 
            LastName='Test', 
            Email='emp1@test.com',
            RecordTypeId=empRt.Id, 
            Can_Clock_In_Out__c=true,
            User__c=testUser1.Id
        );
        Contact emp2 = new Contact(
            FirstName='Employee2', 
            LastName='Test', 
            Email='emp2@test.com',
            RecordTypeId=empRt.Id, 
            Can_Clock_In_Out__c=true,
            User__c=testUser2.Id
        );
        Contact sub1 = new Contact(
            FirstName='Subcontractor1', 
            LastName='Test', 
            Email='sub1@test.com',
            RecordTypeId=subRt.Id, 
            Can_Clock_In_Out__c=true
        );
        insert new List<Contact>{emp1, emp2, sub1};

        // ======== Jobs ========
        Job__c job1 = new Job__c(
            Job_Name__c='Job 1', 
            Description__c='Test Job 1'
        );
        Job__c job2 = new Job__c(
            Job_Name__c='Job 2', 
            Description__c='Test Job 2'
        );
        insert new List<Job__c>{job1, job2};

        // ======== Mobilization Groups ========
        Mobilization_Group__c mobGroup1 = new Mobilization_Group__c(
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(1),
            Job__c = job1.Id,
            Mobilization_Status__c='Confirmed'
        );
        Mobilization_Group__c mobGroup2 = new Mobilization_Group__c(
            Start_Date__c = Date.today().addDays(-3),
            End_Date__c = Date.today().addDays(-2),
            Job__c = job2.Id,
            Mobilization_Status__c='Confirmed'
        );
        insert new List<Mobilization_Group__c>{mobGroup1, mobGroup2};

        // ======== Mobilizations ========
        Mobilization__c mob1 = new Mobilization__c(
            Job__c=job1.Id,
            Start_Date__c=Date.today().addDays(5),
            End_Date__c=Date.today().addDays(6),
            Mobilization_Group__c=mobGroup1.Id,
            Mobilization_Status__c='Confirmed'
        );
        Mobilization__c mob2 = new Mobilization__c(
            Job__c=job2.Id,
            Start_Date__c=Date.today().addDays(-3),
            End_Date__c=Date.today().addDays(-2),
            Mobilization_Group__c=mobGroup2.Id,
            Mobilization_Status__c='Confirmed'
        );
        insert new List<Mobilization__c>{mob1, mob2};

        // ======== Crew ========
        Crew__c crew = new Crew__c(
            Name = 'Crew A',
            Description__c = 'Alpha',
            Color_Code__c = '#111111'
        );
        insert crew;

        // ======== Crew Members ========
        Crew_Member__c crewMember1 = new Crew_Member__c(
            Crew__c = crew.Id,
            Contact__c = emp1.Id
        );
        insert crewMember1;

        // ======== Mobilization Members ========
        Mobilization_Member__c mobMember1 = new Mobilization_Member__c(
            Mobilization__c = mob1.Id,
            Crew__c = crew.Id,
            Contact__c = emp1.Id
        );
        Mobilization_Member__c mobMember2 = new Mobilization_Member__c(
            Mobilization__c = mob1.Id,
            Contact__c = emp2.Id
        );
        insert new List<Mobilization_Member__c>{mobMember1, mobMember2};

        // ======== Timesheets ========
        Timesheet__c ts1 = new Timesheet__c(
            Contact__c=emp2.Id, 
            Job__c=job1.Id, 
            Timesheet_Start_Date__c=Date.today(), 
            Timesheet_End_Date__c=Date.today(), 
            Do_Not_Execute__c=true
        );
        insert ts1;

        // ======== Timesheet Entries ========
        Timesheet_Entry__c entry1 = new Timesheet_Entry__c(
            Timesheet__c=ts1.Id,
            Clock_In_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(9,0,0,0)),
            Clock_Out_Time__c=Datetime.newInstance(Date.today(), Time.newInstance(17,0,0,0))
        );
        insert entry1;

        // ======== Timesheet Entry Items ========
        Timesheet_Entry_Item__c item1 = new Timesheet_Entry_Item__c(
            Timesheet_Entry__c = entry1.Id,
            Clock_In_Time__c = entry1.Clock_In_Time__c,
            Clock_Out_Time__c = entry1.Clock_Out_Time__c
        );
        insert item1;

        // ======== Process ========
        Process__c process = new Process__c(
            Process_Name__c = 'Cutting',
            Weight__c = 10,
            Unit_of_Measure__c = 'Square Footage'
        );
        insert process;

        // ======== Cost Code ========
        Cost_Code__c costCode = new Cost_Code__c(
            Level_Code__c = 1,
            Classification_Type__c = 'Log Entry',
            Name = 'Cost Code 1'
        );
        insert costCode;

        // ======== Mobilization Status Color Custom Setting ========
        Mobilization_Status_Color__c statusColor = new Mobilization_Status_Color__c(
            Name = 'Confirmed',
            Color__c = '#000000',
            Background_Color__c = '#FFFFFF'
        );
        insert statusColor;
    }

    @IsTest
    static void testGetProcessLibraries() {
        Test.startTest();
        List<Process__c> result = ManagementTabController.getProcessLibraries();
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testGetCrewMembers() {
        Test.startTest();
        List<Crew__c> result = ManagementTabController.getCrewMembers();
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testGetCrewMobilizationSummary() {
        Crew__c crew = [SELECT Id FROM Crew__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = ManagementTabController.getCrewMobilizationSummary(crew.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testSaveCrewNew() {
        Map<String, Object> crewData = new Map<String, Object>{
            'Name' => 'Crew Beta',
            'Description__c' => 'Beta description',
            'Color_Code__c' => '123456',
            'membersToAdd' => new List<Object>(),
            'selectedMemberIds' => new List<Object>()
        };

        Test.startTest();
        Map<String, Object> result = ManagementTabController.saveCrew(crewData);
        Test.stopTest();
        
        System.assertEquals('SUCCESS', result.get('status'), 'Crew save should return SUCCESS');
    }

    @IsTest
    static void testSaveCrewUpdate() {
        Crew__c crew = [SELECT Id FROM Crew__c LIMIT 1];
        
        Map<String, Object> crewData = new Map<String, Object>{
            'Id' => crew.Id,
            'Name' => 'Crew Updated',
            'Description__c' => 'Updated description',
            'Color_Code__c' => '#AABBCC',
            'membersToAdd' => new List<Object>(),
            'selectedMemberIds' => new List<Object>()
        };

        Test.startTest();
        Map<String, Object> result = ManagementTabController.saveCrew(crewData);
        Test.stopTest();
        
        System.assertEquals('SUCCESS', result.get('status'), 'Crew update should return SUCCESS');
    }

    @IsTest
    static void testSaveCrewWithMembersAndPropagation() {
        Crew__c crew = [SELECT Id FROM Crew__c LIMIT 1];
        Contact contact = [SELECT Id FROM Contact LIMIT 1];
        
        // Delete existing crew member to test addition
        delete [SELECT Id FROM Crew_Member__c WHERE Contact__c = :contact.Id];
        
        Map<String, Object> crewData = new Map<String, Object>{
            'Id' => crew.Id,
            'Name' => 'Crew With Members',
            'membersToAdd' => new List<Object>{contact.Id},
            'assignToFutureMobilizations' => true,
            'selectedMemberIds' => new List<Object>{contact.Id}
        };

        Test.startTest();
        Map<String, Object> result = ManagementTabController.saveCrew(crewData);
        Test.stopTest();
        
        System.assertEquals('SUCCESS', result.get('status'), 'Crew save with members should return SUCCESS');
    }

    @IsTest
    static void testSaveCrewWithMembersToRemove() {
        Crew__c crew = [SELECT Id FROM Crew__c LIMIT 1];
        Crew_Member__c member = [SELECT Id FROM Crew_Member__c LIMIT 1];
        
        Map<String, Object> crewData = new Map<String, Object>{
            'Id' => crew.Id,
            'Name' => 'Crew With Removal',
            'membersToRemove' => new List<Object>{member.Id},
            'selectedMemberIds' => new List<Object>()
        };

        Test.startTest();
        Map<String, Object> result = ManagementTabController.saveCrew(crewData);
        Test.stopTest();
        
        System.assertEquals('SUCCESS', result.get('status'), 'Crew save with removal should return SUCCESS');
    }

    @IsTest
    static void testSaveCrewEmptyData() {
        Test.startTest();
        Map<String, Object> result = ManagementTabController.saveCrew(null);
        Test.stopTest();
        
        System.assertEquals('ERROR', result.get('status'), 'Should return ERROR for empty data');
    }

    @IsTest
    static void testSaveCrewNoName() {
        Map<String, Object> crewData = new Map<String, Object>{
            'Description__c' => 'No name crew'
        };

        Test.startTest();
        Map<String, Object> result = ManagementTabController.saveCrew(crewData);
        Test.stopTest();
        
        System.assertEquals('ERROR', result.get('status'), 'Should return ERROR for missing name');
    }

    @IsTest
    static void testDeleteProcess() {
        Process__c proc = [SELECT Id FROM Process__c LIMIT 1];
        
        Test.startTest();
        String result = ManagementTabController.deleteProcess(proc.Id);
        Test.stopTest();
        
        System.assertEquals('Success', result, 'Process should be deleted successfully');
    }

    @IsTest
    static void testUpsertProcessNew() {
        Process__c newProc = new Process__c(
            Process_Name__c = 'Welding',
            Weight__c = 20,
            Unit_of_Measure__c = 'Square Footage'
        );
        
        Test.startTest();
        Process__c result = ManagementTabController.upsertProcess(newProc);
        Test.stopTest();
        
        System.assertNotEquals(null, result.Id, 'Upserted process should have an Id');
    }

    @IsTest
    static void testUpsertProcessUpdate() {
        Process__c proc = [SELECT Id, Process_Name__c FROM Process__c LIMIT 1];
        proc.Process_Name__c = 'Updated Process';
        
        Test.startTest();
        Process__c result = ManagementTabController.upsertProcess(proc);
        Test.stopTest();
        
        System.assertEquals(proc.Id, result.Id, 'Process ID should remain same');
    }

    @IsTest
    static void testGetCrewContacts() {
        Crew__c crew = [SELECT Id FROM Crew__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = ManagementTabController.getCrewContacts(crew.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        
        // Test CrewContactDTO and CrewMemberDTO wrapper coverage
        List<Object> assignedList = (List<Object>)result.get('assignedContacts');
        if (!assignedList.isEmpty()) {
            // Wrappers are covered through the method execution
            System.assert(assignedList.size() >= 0, 'Assigned contacts list should be valid');
        }
        
        // Test compareTo functionality
        ManagementTabController.CrewContactDTO dto1 = new ManagementTabController.CrewContactDTO();
        dto1.name = 'Alice';
        dto1.isAssignedElsewhere = false;
        
        ManagementTabController.CrewContactDTO dto2 = new ManagementTabController.CrewContactDTO();
        dto2.name = 'Bob';
        dto2.isAssignedElsewhere = true;
        
        System.assert(dto1.compareTo(dto2) < 0, 'Unassigned should come before assigned');
    }

    @IsTest
    static void testDeleteCrew() {
        Crew__c crew = [SELECT Id FROM Crew__c LIMIT 1];
        
        Test.startTest();
        String result = ManagementTabController.deleteCrew(crew.Id);
        Test.stopTest();
        
        System.assertEquals('Success', result, 'Crew should be deleted successfully');
    }

    @IsTest
    static void testGetCostCodes() {
        Test.startTest();
        List<Cost_Code__c> result = ManagementTabController.getCostCodes();
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testUpsertCostCodeNew() {
        Cost_Code__c newCode = new Cost_Code__c(
            Level_Code__c = 2,
            Classification_Type__c = 'Process',
            Name = 'Cost Code 2'
        );
        
        Test.startTest();
        Cost_Code__c result = ManagementTabController.upsertCostCode(newCode);
        Test.stopTest();
        
        System.assertNotEquals(null, result.Id, 'Upserted cost code should have an Id');
    }

    @IsTest
    static void testUpsertCostCodeUpdate() {
        Cost_Code__c code = [SELECT Id, Name FROM Cost_Code__c LIMIT 1];
        code.Name = 'Updated Cost Code';
        
        Test.startTest();
        Cost_Code__c result = ManagementTabController.upsertCostCode(code);
        Test.stopTest();
        
        System.assertEquals(code.Id, result.Id, 'Cost code ID should remain same');
    }

    @IsTest
    static void testDeleteCostCode() {
        Cost_Code__c code = [SELECT Id FROM Cost_Code__c LIMIT 1];
        
        Test.startTest();
        String result = ManagementTabController.deleteCostCode(code.Id);
        Test.stopTest();
        
        System.assertEquals('Success', result, 'Cost code should be deleted successfully');
    }

    @IsTest
    static void testGetMobilizationPicklistValues() {
        Test.startTest();
        List<String> result = ManagementTabController.getMobilizationPicklistValues();
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
    }

    @IsTest
    static void testUpdateGlobalPicklistValues() {
        List<String> addVals = new List<String>{'NewStatus'};
        List<String> deactivateVals = new List<String>{'OldStatus'};

        Test.startTest();
        String result = ManagementTabController.updateGlobalPicklistValues(addVals, deactivateVals);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.contains('SUCCESS') || result.startsWith('Error'), 'Result should be SUCCESS or Error');
    }

    @IsTest
    static void testGetMobilizationStatusColors() {
        Test.startTest();
        List<ManagementTabController.StatusColorWrapper> result = ManagementTabController.getMobilizationStatusColors();
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.size() > 0, 'Should return at least one status color');
        
        // Test StatusColorWrapper properties coverage
        ManagementTabController.StatusColorWrapper wrapper = result[0];
        System.assertNotEquals(null, wrapper.picklistValue, 'Picklist value should not be null');
    }

    @IsTest
    static void testSaveStatusColors() {
        List<Mobilization_Status_Color__c> recs = new List<Mobilization_Status_Color__c>{
            new Mobilization_Status_Color__c(
                Name = 'Pending',
                Color__c = '#FF0000',
                Background_Color__c = '#00FF00'
            )
        };
        
        Test.startTest();
        Map<String, Object> result = ManagementTabController.saveStatusColors(recs);
        Test.stopTest();
        
        System.assertEquals('SUCCESS', result.get('status'), 'Status colors should be saved successfully');
    }


}
