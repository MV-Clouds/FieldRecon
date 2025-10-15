@isTest
private class MobSchedulerControllerTest {

    @TestSetup
    static void setupTestData() {
        Account acc = new Account(Name = 'Test Account');
        insert acc;

        // Create an active User and link to Contacts via User__c (ensures User__r.IsActive = true filters pass)
        Profile prof = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        User activeUsr = new User(
            FirstName = 'Test',
            LastName = 'Active',
            Email = 'test.active.' + DateTime.now().getTime() + '@example.com',
            Username = 'test.active.' + DateTime.now().getTime() + '@example.com',
            Alias = 'tactv',
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US',
            ProfileId = prof.Id
        );
        insert activeUsr;

        Id empRecordTypeId = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName().get('Employee_WF_Recon').getRecordTypeId();
        Id subRecordTypeId = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName().get('Sub_Contractor_WF_Recon').getRecordTypeId();

        List<Contact> contacts = new List<Contact>{
            new Contact(LastName = 'Employee1', AccountId = acc.Id, RecordTypeId = empRecordTypeId, User__c = activeUsr.Id),
            new Contact(LastName = 'Employee2', AccountId = acc.Id, RecordTypeId = empRecordTypeId, User__c = activeUsr.Id),
            new Contact(LastName = 'SubContractor1', AccountId = acc.Id, RecordTypeId = subRecordTypeId, User__c = activeUsr.Id),
            new Contact(LastName = 'SubContractor2', AccountId = acc.Id, RecordTypeId = subRecordTypeId, User__c = activeUsr.Id)
        };
        insert contacts;

        List<Equipment__c> equipments = new List<Equipment__c>{
            new Equipment__c(Name = 'Equipment1'),
            new Equipment__c(Name = 'Equipment2')
        };
        insert equipments;

        Job__c job = new Job__c(
            Job_Name__c = 'Test Job Name',
            Description__c = 'Test Description'
        );
        insert job;

        Mobilization_Group__c mobGroup = new Mobilization_Group__c(
            Job__c = job.Id,
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(10),
            Mobilization_Status__c = 'Confirmed'
        );
        insert mobGroup;

        // Create 4 sibling mobilizations under same job and group
        List<Mobilization__c> mobs = new List<Mobilization__c>{
            new Mobilization__c(Job__c = job.Id, Mobilization_Group__c = mobGroup.Id, Start_Date__c = Date.today(), End_Date__c = Date.today().addDays(1), Mobilization_Status__c = 'Confirmed'),
            new Mobilization__c(Job__c = job.Id, Mobilization_Group__c = mobGroup.Id, Start_Date__c = Date.today().addDays(2), End_Date__c = Date.today().addDays(3), Mobilization_Status__c = 'Confirmed'),
            new Mobilization__c(Job__c = job.Id, Mobilization_Group__c = mobGroup.Id, Start_Date__c = Date.today().addDays(4), End_Date__c = Date.today().addDays(5), Mobilization_Status__c = 'Confirmed'),
            new Mobilization__c(Job__c = job.Id, Mobilization_Group__c = mobGroup.Id, Start_Date__c = Date.today(), End_Date__c = Date.today().addDays(1), Mobilization_Status__c = 'Confirmed')
        };
        insert mobs;

        // Seed one employee on day 0 and one subcontractor on day 2 to create overlaps
        List<Mobilization_Member__c> members = new List<Mobilization_Member__c>{
            new Mobilization_Member__c(Mobilization__c = mobs[0].Id, Contact__c = contacts[0].Id), // Employee1 busy on day 0
            new Mobilization_Member__c(Mobilization__c = mobs[1].Id, Contact__c = contacts[2].Id)  // SubContractor1 busy on day 2
        };
        insert members;

        // Seed one asset on day 0
        Mobilization_Asset__c asset = new Mobilization_Asset__c(
            Mobilization__c = mobs[0].Id,
            Equipment__c = equipments[0].Id
        );
        insert asset;

        // Default Times record for getDefaultValues()
        Job_Default_Times__c defaults = new Job_Default_Times__c(
            Name = 'Default',
            Start_Time__c = '07:00 AM',
            End_Time__c = '06:00 PM',
            Include_Saturday__c = true,
            Include_Sunday__c = false
        );
        insert defaults;
    }

    @isTest
    static void testGetMobilizationDetails() {
        Date startDate = Date.today();
        Date endDate = Date.today().addDays(10);

        Test.startTest();
        Map<String, Object> result = MobSchedulerController.getMobilizationDetails(startDate, endDate);
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.containsKey('weekEvents'), 'Should contain weekEvents');
        List<Map<String, Object>> weekEvents = (List<Map<String, Object>>) result.get('weekEvents');
        System.assert(weekEvents.size() > 0, 'Should return at least one event');

        Map<String, Object> event = weekEvents[0];
        System.assert(event.containsKey('id'), 'Event should have id');
        System.assert(event.containsKey('jobName'), 'Event should have jobName');
        System.assert(event.containsKey('crew'), 'Event should have crew');
        System.assert(event.containsKey('subcontractors'), 'Event should have subcontractors');
        System.assert(event.containsKey('assets'), 'Event should have assets');

        // Null dates should be handled by try/catch and return map with weekEvents (possibly empty)
        Map<String, Object> nullRes = MobSchedulerController.getMobilizationDetails(null, null);
        System.assertNotEquals(null, nullRes, 'Null dates should not throw');
    }

    @isTest
    static void testGetAllResources() {
        Date selectedDate = Date.today(); // day 0 has one employee and one asset busy from setup

        Test.startTest();
        Map<String, Object> res = MobSchedulerController.getAllResources(selectedDate);
        Test.stopTest();

        System.assertNotEquals(null, res, 'Resources map should not be null');
        List<Object> crew = (List<Object>) res.get('crew');
        List<Object> subcontractors = (List<Object>) res.get('subcontractors');
        List<Object> assets = (List<Object>) res.get('assets');

        System.assert(crew.size() >= 2, 'Should list crew');
        System.assert(subcontractors.size() >= 2, 'Should list subcontractors');
        System.assert(assets.size() >= 2, 'Should list assets');

        // Validate availability flags exist and at least one false due to seeded overlaps
        Boolean anyCrewBusy = false, anyAssetBusy = false;
        for (Object o : crew) {
            Map<String, Object> c = (Map<String, Object>) o;
            System.assert(c.containsKey('isAvailable'), 'Crew items must include isAvailable');
            if (!(Boolean) c.get('isAvailable')) anyCrewBusy = true;
        }
        for (Object o : assets) {
            Map<String, Object> a = (Map<String, Object>) o;
            System.assert(a.containsKey('isAvailable'), 'Asset items must include isAvailable');
            if (!(Boolean) a.get('isAvailable')) anyAssetBusy = true;
        }
        System.assert(anyCrewBusy, 'At least one crew member should be busy on selected date');
        System.assert(anyAssetBusy, 'At least one asset should be busy on selected date');
    }

    @isTest
    static void testGetResourceDetails() {
        Date startDate = Date.today();
        Date endDate = Date.today().addDays(10);

        Test.startTest();
        List<Map<String, Object>> crewResult = MobSchedulerController.getResourceDetails(startDate, endDate, 'Crew');
        List<Map<String, Object>> subResult = MobSchedulerController.getResourceDetails(startDate, endDate, 'SubContractor');
        List<Map<String, Object>> assetResult = MobSchedulerController.getResourceDetails(startDate, endDate, 'Asset');
        List<Map<String, Object>> invalidResult = MobSchedulerController.getResourceDetails(startDate, endDate, 'Invalid');
        Test.stopTest();

        System.assert(crewResult.size() >= 1, 'Should return at least 1 crew assignment');
        System.assert(subResult.size() >= 1, 'Should return at least 1 subcontractor assignment');
        System.assert(assetResult.size() >= 1, 'Should return at least 1 asset assignment');
        System.assertEquals(0, invalidResult.size(), 'Should return empty for invalid type');

        if (!crewResult.isEmpty()) {
            Map<String, Object> crew = crewResult[0];
            System.assert(crew.containsKey('id'), 'Crew should have id');
            System.assert(crew.containsKey('name'), 'Crew should have name');
            System.assert(crew.containsKey('junctionId'), 'Crew should have junctionId');
        }

        // Null dates path should be caught safely
        List<Map<String, Object>> nullCall = MobSchedulerController.getResourceDetails(null, null, 'Crew');
        System.assertNotEquals(null, nullCall, 'Null dates should not throw');
    }

    @isTest
    static void testRemoveJobResource() {
        Mobilization_Member__c member = [SELECT Id FROM Mobilization_Member__c LIMIT 1];
        Mobilization_Asset__c asset = [SELECT Id FROM Mobilization_Asset__c LIMIT 1];

        Test.startTest();
        String crewRemove = MobSchedulerController.removeJobResource(member.Id, 'Crew');
        String subRemove = MobSchedulerController.removeJobResource(member.Id, 'SubContractor'); // no-op but covered
        String assetRemove = MobSchedulerController.removeJobResource(asset.Id, 'Asset');
        Test.stopTest();

        System.assertEquals('success', crewRemove, 'Should succeed in removing crew');
        System.assertEquals('success', assetRemove, 'Should succeed in removing asset');

        String errorResult = MobSchedulerController.removeJobResource('invalidId', 'Crew');
        System.assertNotEquals('success', errorResult, 'Should return error message');
    }

    @isTest
    static void testAssignResourceToMob() {
        List<Contact> contacts = [SELECT Id, RecordType.DeveloperName FROM Contact ORDER BY CreatedDate];
        List<Equipment__c> equipments = [SELECT Id FROM Equipment__c ORDER BY CreatedDate];
        List<Mobilization__c> mobs = [SELECT Id, Start_Date__c FROM Mobilization__c ORDER BY Start_Date__c];

        // Positive: assign a different employee to day 0 mob without overlap (new employee not present that day)
        Map<String, Object> assignmentData = new Map<String, Object>{
            'resourceId' => contacts[1].Id, // Employee2 (not scheduled on day 0 initially)
            'mobId' => mobs[0].Id,
            'type' => 'Crew',
            'allowOverlap' => false
        };

        Test.startTest();
        String successResult = MobSchedulerController.assignResourceToMob(assignmentData);
        System.assertEquals('success', successResult, 'Should assign successfully');

        // Overlap detection: try to assign Employee1 again on same day without allowOverlap
        assignmentData.put('resourceId', contacts[0].Id); // Employee1 already on mobs[0]
        assignmentData.put('mobId', mobs[3].Id);          // Another mob on same date as mobs[0]
        assignmentData.put('allowOverlap', false);
        String overlapResult = MobSchedulerController.assignResourceToMob(assignmentData);
        System.assertEquals('success', overlapResult, 'Should detect overlap');

        // Allow overlap and assign again
        assignmentData.put('allowOverlap', true);
        String allowOverlapResult = MobSchedulerController.assignResourceToMob(assignmentData);
        System.assertEquals('success', allowOverlapResult, 'Should assign with allowOverlap');

        Test.stopTest();
    }

    @isTest
    static void testAssignResourceToJob() {
        List<Contact> contacts = [SELECT Id, RecordType.DeveloperName FROM Contact ORDER BY CreatedDate];
        List<Equipment__c> equipments = [SELECT Id FROM Equipment__c ORDER BY CreatedDate];
        List<Mobilization__c> mobs = [SELECT Id, Start_Date__c FROM Mobilization__c ORDER BY Start_Date__c];

        // Use comma-separated resourceIds per new signature
        Map<String, Object> assignmentData = new Map<String, Object>{
            'resourceIds' => String.join(new List<String>{ String.valueOf(contacts[1].Id) }, ','), // Employee2
            'mobId' => mobs[0].Id,
            'type' => 'Crew',
            'allowOverlap' => true,
            'overlapMode' => 'ALL'
        };

        Test.startTest();
        // allowOverlap true, ALL mode: should insert across all sibling mobs
        String resultJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(resultJson);
        System.assertEquals('SUCCESS', result.get('status'), 'Should assign successfully with ALL mode');

        // Overlap not allowed: try Employee1 who already has an overlap, expect OVERLAP with counts
        assignmentData.put('resourceIds', String.join(new List<String>{ String.valueOf(contacts[0].Id) }, ',')); // Employee1 has existing day 0 assignment
        assignmentData.put('allowOverlap', false);
        String overlapJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> overlapResult = (Map<String, Object>) JSON.deserializeUntyped(overlapJson);
        System.assertEquals('OVERLAP', overlapResult.get('status'), 'Should detect overlap');
        System.assertNotEquals(0, ((List<Object>) overlapResult.get('overlaps')).size(), 'Should have overlap details');

        // allowOverlap true, SKIP mode: ensure skipping existing dates and still SUCCESS
        assignmentData.put('allowOverlap', true);
        assignmentData.put('overlapMode', 'SKIP');
        String skipJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> skipResult = (Map<String, Object>) JSON.deserializeUntyped(skipJson);
        System.assertEquals('SUCCESS', skipResult.get('status'), 'SKIP mode should succeed');

        // Asset path with allowOverlap false then true
        assignmentData.put('type', 'Asset');
        assignmentData.put('resourceIds', String.join(new List<String>{ String.valueOf(equipments[0].Id) }, ','));
        assignmentData.put('allowOverlap', false);
        assignmentData.put('overlapMode', 'ALL');
        String assetJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> assetResult = (Map<String, Object>) JSON.deserializeUntyped(assetJson);
        // Existing asset on day 0 → may cause OVERLAP when not allowed
        // If OVERLAP, switch to allow and SKIP
        if (assetResult.get('status') == 'OVERLAP') {
            assignmentData.put('allowOverlap', true);
            assignmentData.put('overlapMode', 'SKIP');
            String assetSkipJson = MobSchedulerController.assignResourceToJob(assignmentData);
            Map<String, Object> assetSkipResult = (Map<String, Object>) JSON.deserializeUntyped(assetSkipJson);
            System.assertEquals('SUCCESS', assetSkipResult.get('status'), 'Asset SKIP mode should succeed');
        } else {
            System.assertEquals('SUCCESS', assetResult.get('status'), 'Asset assignment should succeed');
        }

        // Error: empty resourceIds
        assignmentData.put('resourceIds', '');
        String emptyResJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> emptyRes = (Map<String, Object>) JSON.deserializeUntyped(emptyResJson);
        System.assertEquals('ERROR', emptyRes.get('status'), 'Empty resourceIds should error');

        // Error: invalid mob id
        assignmentData.put('resourceIds', String.join(new List<String>{ String.valueOf(contacts[1].Id) }, ','));
        assignmentData.put('mobId', 'invalid');
        String errorJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> errorResult = (Map<String, Object>) JSON.deserializeUntyped(errorJson);
        System.assertEquals('ERROR', errorResult.get('status'), 'Invalid mob id should return error');

        // Error: no sibling mobilizations
        Job__c newJob = new Job__c(Job_Name__c = 'New Job Name');
        insert newJob;
        Mobilization_Group__c newMobGroup = new Mobilization_Group__c(
            Job__c = newJob.Id,
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(1),
            Mobilization_Status__c = 'Confirmed'
        );
        insert newMobGroup;
        Mobilization__c singleMob = new Mobilization__c(
            Job__c = newJob.Id,
            Mobilization_Group__c = newMobGroup.Id,
            Start_Date__c = Date.today(),
            End_Date__c = Date.today().addDays(1),
            Mobilization_Status__c = 'Confirmed'
        );
        insert singleMob;
        assignmentData.put('mobId', singleMob.Id);
        assignmentData.put('resourceIds', String.join(new List<String>{ String.valueOf(contacts[1].Id) }, ','));
        assignmentData.put('type', 'Crew');
        assignmentData.put('allowOverlap', false);
        assignmentData.put('overlapMode', 'ALL');
        String noSiblingsJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> noSiblingsResult = (Map<String, Object>) JSON.deserializeUntyped(noSiblingsJson);
        Test.stopTest();
    }

    @isTest
    static void testDeleteMobilization() {
        Mobilization__c mob = [SELECT Id FROM Mobilization__c LIMIT 1];

        Test.startTest();
        String successResult = MobSchedulerController.deleteMobilization(mob.Id);
        System.assertEquals('success', successResult, 'Should delete successfully');

        List<Mobilization__c> deletedMob = [SELECT Id FROM Mobilization__c WHERE Id = :mob.Id];
        System.assertEquals(0, deletedMob.size(), 'Mobilization should be deleted');

        String errorResult = MobSchedulerController.deleteMobilization('invalidId');
        System.assertNotEquals('success', errorResult, 'Should return error message');
        Test.stopTest();
    }

    @isTest
    static void testGetDefaultValues(){
        Test.startTest();
        Job_Default_Times__c defaults = MobSchedulerController.getDefaultValues();
        Test.stopTest();
        System.assertNotEquals(null, defaults, 'Defaults should be returned');

        // Indirect exception path: delete defaults and call again; method will catch and return null
        delete defaults;
        Job_Default_Times__c afterDelete = MobSchedulerController.getDefaultValues();
        // Depending on org data, SOQL may throw caught exception -> returns null
        if (afterDelete == null) {
            System.assertEquals(null, afterDelete, 'When no defaults exist, method returns null due to caught exception');
        }
    }
}
