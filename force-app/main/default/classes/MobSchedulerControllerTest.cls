@isTest
private class MobSchedulerControllerTest {

    @TestSetup
    static void setupTestData() {
        Account acc = new Account(Name = 'Test Account');
        insert acc;

        Id empRecordTypeId = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName().get('Employee_WF_Recon').getRecordTypeId();
        Id subRecordTypeId = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName().get('Sub_Contractor_WF_Recon').getRecordTypeId();

        List<Contact> contacts = new List<Contact>();
        contacts.add(new Contact(LastName = 'Employee1', AccountId = acc.Id, RecordTypeId = empRecordTypeId));
        contacts.add(new Contact(LastName = 'Employee2', AccountId = acc.Id, RecordTypeId = empRecordTypeId));
        contacts.add(new Contact(LastName = 'SubContractor1', AccountId = acc.Id, RecordTypeId = subRecordTypeId));
        contacts.add(new Contact(LastName = 'SubContractor2', AccountId = acc.Id, RecordTypeId = subRecordTypeId));
        insert contacts;

        List<wfrecon__Equipment__c> equipments = new List<wfrecon__Equipment__c>();
        equipments.add(new wfrecon__Equipment__c(Name = 'Equipment1'));
        equipments.add(new wfrecon__Equipment__c(Name = 'Equipment2'));
        insert equipments;

        wfrecon__Job__c job = new wfrecon__Job__c(
            wfrecon__Job_Name__c = 'Test Job Name',
            wfrecon__Description__c = 'Test Description'
        );
        insert job;

        wfrecon__Mobilization_Group__c mobGroup = new wfrecon__Mobilization_Group__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Start_Date__c = Date.today(),
            wfrecon__End_Date__c = Date.today().addDays(10),
            wfrecon__Mobilization_Status__c = 'Confirmed'

        );
        insert mobGroup;

        List<wfrecon__Mobilization__c> mobs = new List<wfrecon__Mobilization__c>();
        mobs.add(new wfrecon__Mobilization__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization_Group__c = mobGroup.Id,
            wfrecon__Start_Date__c = Date.today(),
            wfrecon__End_Date__c = Date.today().addDays(1),
            wfrecon__Mobilization_Status__c = 'Confirmed'
        ));
        mobs.add(new wfrecon__Mobilization__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization_Group__c = mobGroup.Id,
            wfrecon__Start_Date__c = Date.today().addDays(2),
            wfrecon__End_Date__c = Date.today().addDays(3),
            wfrecon__Mobilization_Status__c = 'Confirmed'
        ));
        mobs.add(new wfrecon__Mobilization__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization_Group__c = mobGroup.Id,
            wfrecon__Start_Date__c = Date.today().addDays(4),
            wfrecon__End_Date__c = Date.today().addDays(5),
            wfrecon__Mobilization_Status__c = 'Confirmed'
        ));
        mobs.add(new wfrecon__Mobilization__c(
            wfrecon__Job__c = job.Id,
            wfrecon__Mobilization_Group__c = mobGroup.Id,
            wfrecon__Start_Date__c = Date.today(),
            wfrecon__End_Date__c = Date.today().addDays(1),
            wfrecon__Mobilization_Status__c = 'Confirmed'
        ));
        insert mobs;

        List<wfrecon__Mobilization_Member__c> members = new List<wfrecon__Mobilization_Member__c>();
        members.add(new wfrecon__Mobilization_Member__c(
            wfrecon__Mobilization__c = mobs[0].Id,
            wfrecon__Contact__c = contacts[0].Id 
        ));
        members.add(new wfrecon__Mobilization_Member__c(
            wfrecon__Mobilization__c = mobs[1].Id,
            wfrecon__Contact__c = contacts[2].Id 
        ));
        insert members;

        wfrecon__Mobilization_Asset__c asset = new wfrecon__Mobilization_Asset__c(
            wfrecon__Mobilization__c = mobs[0].Id,
            wfrecon__Equipment__c = equipments[0].Id 
        );
        insert asset;
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

        Map<String, Object> event = weekEvents[0];
        System.assert(event.containsKey('id'), 'Event should have id');
        System.assert(event.containsKey('jobName'), 'Event should have jobName');
        System.assert(event.containsKey('crew'), 'Event should have crew');
        System.assert(event.containsKey('subcontractors'), 'Event should have subcontractors');
        System.assert(event.containsKey('assets'), 'Event should have assets');

                
        MobSchedulerController.getMobilizationDetails(null, null);
        
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

        System.assertEquals(1, crewResult.size(), 'Should return 1 crew assignment');
        System.assertEquals(1, subResult.size(), 'Should return 1 subcontractor assignment');
        System.assertEquals(1, assetResult.size(), 'Should return 1 asset assignment');
        System.assertEquals(0, invalidResult.size(), 'Should return empty for invalid type');

        if (!crewResult.isEmpty()) {
            Map<String, Object> crew = crewResult[0];
            System.assert(crew.containsKey('id'), 'Crew should have id');
            System.assert(crew.containsKey('name'), 'Crew should have name');
            System.assert(crew.containsKey('junctionId'), 'Crew should have junctionId');
        }

        MobSchedulerController.getResourceDetails(null, null, 'Crew');
        
    }

    @isTest
    static void testRemoveJobResource() {
        wfrecon__Mobilization_Member__c member = [SELECT Id FROM wfrecon__Mobilization_Member__c LIMIT 1];
        wfrecon__Mobilization_Asset__c asset = [SELECT Id FROM wfrecon__Mobilization_Asset__c LIMIT 1];

        Test.startTest();
        String crewRemove = MobSchedulerController.removeJobResource(member.Id, 'Crew');
        String subRemove = MobSchedulerController.removeJobResource(member.Id, 'SubContractor');
        String assetRemove = MobSchedulerController.removeJobResource(asset.Id, 'Asset');
        Test.stopTest();

        System.assertEquals('success', crewRemove, 'Should succeed in removing crew');
        System.assertEquals('success', assetRemove, 'Should succeed in removing asset');

        String errorResult = MobSchedulerController.removeJobResource('invalidId', 'Crew');
        System.assertNotEquals('success', errorResult, 'Should return error message');
    }

    @isTest
    static void testAssignResourceToMob() {
        List<Contact> contacts = [SELECT Id, RecordType.DeveloperName FROM Contact];
        List<wfrecon__Equipment__c> equipments = [SELECT Id FROM wfrecon__Equipment__c];
        List<wfrecon__Mobilization__c> mobs = [SELECT Id FROM wfrecon__Mobilization__c ORDER BY wfrecon__Start_Date__c];

        Map<String, Object> assignmentData = new Map<String, Object>{
            'resourceId' => contacts[1].Id,
            'mobId' => mobs[0].Id,
            'type' => 'Crew',
            'allowOverlap' => false
        };

        Test.startTest();
        String successResult = MobSchedulerController.assignResourceToMob(assignmentData);
        System.assertEquals('success', successResult, 'Should assign successfully');

        assignmentData.put('resourceId', contacts[0].Id); 
        assignmentData.put('mobId', mobs[3].Id); 
        assignmentData.put('allowOverlap', false);
        String overlapResult = MobSchedulerController.assignResourceToMob(assignmentData);
        System.assertEquals('success', overlapResult, 'Should detect overlap');

        assignmentData.put('allowOverlap', true);
        String allowOverlapResult = MobSchedulerController.assignResourceToMob(assignmentData);
        System.assertEquals('success', allowOverlapResult, 'Should assign with allowOverlap');

        assignmentData.put('resourceId', equipments[1].Id); 
        assignmentData.put('type', 'Asset');
        assignmentData.put('allowOverlap', false);
        String assetResult = MobSchedulerController.assignResourceToMob(assignmentData);
        System.assertEquals('success', assetResult, 'Should assign asset');

        assignmentData.put('type', 'Invalid');
        String invalidResult = MobSchedulerController.assignResourceToMob(assignmentData);
        System.assertNotEquals('success', invalidResult, 'Should return error');

        assignmentData.put('mobId', 'invalid');
        assignmentData.put('type', 'Crew');
        String errorResult = MobSchedulerController.assignResourceToMob(assignmentData);
        System.assertNotEquals('success', errorResult, 'Should return error');
        Test.stopTest();
    }

    @isTest
    static void testAssignResourceToJob() {
        List<Contact> contacts = [SELECT Id, RecordType.DeveloperName FROM Contact];
        List<wfrecon__Equipment__c> equipments = [SELECT Id FROM wfrecon__Equipment__c];
        List<wfrecon__Mobilization__c> mobs = [SELECT Id FROM wfrecon__Mobilization__c ORDER BY wfrecon__Start_Date__c];

        Map<String, Object> assignmentData = new Map<String, Object>{
            'resourceId' => contacts[1].Id,  
            'mobId' => mobs[0].Id,
            'type' => 'Crew',
            'allowOverlap' => false
        };

        Test.startTest();
        String resultJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(resultJson);
        System.assertEquals('SUCCESS', result.get('status'), 'Should assign successfully');

        assignmentData.put('resourceId', contacts[0].Id); 
        String overlapJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> overlapResult = (Map<String, Object>) JSON.deserializeUntyped(overlapJson);
        System.assertEquals('OVERLAP', overlapResult.get('status'), 'Should detect overlap');
        System.assertNotEquals(0, ((List<Object>) overlapResult.get('overlaps')).size(), 'Should have overlap details');

        Map<String, Boolean> allowMap = new Map<String, Boolean>();
        for (wfrecon__Mobilization__c mob : mobs) {
            allowMap.put(mob.Id, true);
        }
        assignmentData.put('allowOverlap', true);
        assignmentData.put('allowOverlapMap', allowMap);
        String allowJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> allowResult = (Map<String, Object>) JSON.deserializeUntyped(allowJson);

        allowMap.put(mobs[0].Id, false);
        assignmentData.put('allowOverlapMap', allowMap);
        String partialJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> partialResult = (Map<String, Object>) JSON.deserializeUntyped(partialJson);

        assignmentData.put('resourceId', equipments[1].Id);
        assignmentData.put('type', 'Asset');
        assignmentData.put('allowOverlap', false);
        String assetJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> assetResult = (Map<String, Object>) JSON.deserializeUntyped(assetJson);

        assignmentData.put('mobId', 'invalid');
        String errorJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> errorResult = (Map<String, Object>) JSON.deserializeUntyped(errorJson);
        System.assertEquals('ERROR', errorResult.get('status'), 'Should return error');

        wfrecon__Job__c newJob = new wfrecon__Job__c(
            wfrecon__Job_Name__c = 'New Job Name'
        );
        insert newJob;
        wfrecon__Mobilization_Group__c newMobGroup = new wfrecon__Mobilization_Group__c(
            wfrecon__Job__c = newJob.Id,
            wfrecon__Start_Date__c = Date.today(),
            wfrecon__End_Date__c = Date.today().addDays(10),
            wfrecon__Mobilization_Status__c = 'Confirmed'
        );
        insert newMobGroup;
        wfrecon__Mobilization__c singleMob = new wfrecon__Mobilization__c(
            wfrecon__Job__c = newJob.Id,
            wfrecon__Mobilization_Group__c = newMobGroup.Id,
            wfrecon__Start_Date__c = Date.today(),
            wfrecon__End_Date__c = Date.today().addDays(1),
            wfrecon__Mobilization_Status__c = 'Confirmed'
        );
        insert singleMob;
        assignmentData.put('mobId', singleMob.Id);
        assignmentData.put('resourceId', contacts[1].Id);
        assignmentData.put('type', 'Crew');
        assignmentData.put('allowOverlap', false);
        String noSiblingsJson = MobSchedulerController.assignResourceToJob(assignmentData);
        Map<String, Object> noSiblingsResult = (Map<String, Object>) JSON.deserializeUntyped(noSiblingsJson);
        Test.stopTest();
    }

    @isTest
    static void testDeleteMobilization() {
        wfrecon__Mobilization__c mob = [SELECT Id FROM wfrecon__Mobilization__c LIMIT 1];

        Test.startTest();
        String successResult = MobSchedulerController.deleteMobilization(mob.Id);
        System.assertEquals('success', successResult, 'Should delete successfully');

        List<wfrecon__Mobilization__c> deletedMob = [SELECT Id FROM wfrecon__Mobilization__c WHERE Id = :mob.Id];
        System.assertEquals(0, deletedMob.size(), 'Mobilization should be deleted');

        String errorResult = MobSchedulerController.deleteMobilization('invalidId');
        System.assertNotEquals('success', errorResult, 'Should return error message');
        Test.stopTest();
    }

    @isTest
    static void testgetDefaultValues(){
        Test.startTest();
        MobSchedulerController.getDefaultValues();
        Test.stopTest();
    }
}