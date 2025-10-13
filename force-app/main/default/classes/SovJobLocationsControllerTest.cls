@IsTest
public with sharing class SovJobLocationsControllerTest {

    @TestSetup
    static void setupTestData() {
        // 1️⃣ Create Job
        Job__c job = new Job__c(
            Job_Name__c = 'Test Construction Job'
        );
        insert job;

        // 2️⃣ Create Scope Entry (linked to Job)
        Scope_Entry__c scopeEntry = new Scope_Entry__c(
            Name = 'Foundation Scope',
            Job__c = job.Id,
            Contract_Value__c = 100000,
            Type__c = 'Contract'
        );
        insert scopeEntry;

        // 3️⃣ Create Scope Entry Processes
        List<Scope_Entry_Process__c> scopeEntryProcesses = new List<Scope_Entry_Process__c>{
            new Scope_Entry_Process__c(
                Scope_Entry__c = scopeEntry.Id,
                Process_Name__c = 'Excavation',
                Process_Type__c = 'Grinding',
                Measurement_Type__c = 'Square Feet',
                Weight__c = 40,
                Sequence__c = 1,
                Job__c = job.Id
            ),
            new Scope_Entry_Process__c(
                Scope_Entry__c = scopeEntry.Id,
                Process_Name__c = 'Concrete Pouring',
                Process_Type__c = 'Generic',
                Measurement_Type__c = 'Square Feet',
                Weight__c = 60,
                Sequence__c = 2,
                Job__c = job.Id
            )
        };
        insert scopeEntryProcesses;

        // 4️⃣ Create Locations
        List<Location__c> locations = new List<Location__c>{
            new Location__c(Name = 'Main Hall', Quantity__c = 500, Job__c = job.Id),
            new Location__c(Name = 'Conference Room', Quantity__c = 300, Job__c = job.Id),
            new Location__c(Name = 'Lobby', Quantity__c = 200, Job__c = job.Id)
        };
        insert locations;

        // 5️⃣ Create Location Processes
        List<Location_Process__c> locationProcesses = new List<Location_Process__c>();
        for (Location__c loc : locations) {
            for (Scope_Entry_Process__c proc : scopeEntryProcesses) {
                Decimal totalWeight = 100; // 40 + 60
                Decimal locationShare = loc.Quantity__c / 1000; // total 1000 sq ft
                Decimal processShare = proc.Weight__c / totalWeight;
                Decimal contractPrice = scopeEntry.Contract_Value__c * locationShare * processShare;

                locationProcesses.add(new Location_Process__c(
                    Location__c = loc.Id,
                    Scope_Entry_Process__c = proc.Id,
                    Sequence__c = proc.Sequence__c,
                    Contract_Price__c = contractPrice
                ));
            }
        }
        insert locationProcesses;
    }

    // 🧪 Test getLocationEntries
    @IsTest
    static void testGetLocationEntries() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Test.startTest();
        Map<String, Object> result = SovJobLocationsController.getLocationEntries(job.Id);
        Test.stopTest();

        System.assert(result.get('locationProcessMap') != null, 'Should return location process map');
    }

    // 🧪 Test createLocationEntry
    @IsTest
    static void testCreateLocationEntry() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Map<String, Object> newLocData = new Map<String, Object>{
            'name' => 'New Location A',
            'squareFeet' => 250,
            'crackCount' => 2,
            'distressedEdge' => 1,
            'distressedJoint' => 3,
            'miscDefectCount' => 0,
            'cureTimeDays' => 7,
            'jobId' => job.Id
        };

        Test.startTest();
        String result = SovJobLocationsController.createLocationEntry(newLocData);
        Test.stopTest();

        System.assertEquals('Success', result, 'Should return success on location creation');
        System.assertEquals(1, [SELECT COUNT() FROM Location__c WHERE Name = 'New Location A']);
    }

    // 🧪 Test deleteLocationEntries
    @IsTest
    static void testDeleteLocationEntries() {
        List<Location__c> locs = [SELECT Id FROM Location__c LIMIT 2];
        List<Id> locIds = new List<Id>();
        for (Location__c l : locs) locIds.add(l.Id);

        Test.startTest();
        String result = SovJobLocationsController.deleteLocationEntries(locIds);
        Test.stopTest();

        System.assert(result.contains('Success'), 'Should delete location entries successfully');
        System.assertEquals(0, [SELECT COUNT() FROM Location__c WHERE Id IN :locIds], 'Locations should be deleted');
    }

    // 🧪 Test getLocationConfiguration
    @IsTest
    static void testGetLocationConfiguration() {

        Test.startTest();
        Map<String, Object> result = SovJobLocationsController.getLocationConfiguration();
        Test.stopTest();

        System.assert(result.get('fieldsData') != null, 'Should return fields data');
        System.assert(result.get('pageSize') != null, 'Should return page size');
    }

    // 🧪 Test saveInlineEdits with recalculation trigger
    @IsTest
    static void testSaveInlineEdits() {
        Location__c loc = [SELECT Id, Quantity__c FROM Location__c LIMIT 1];
        loc.Quantity__c = loc.Quantity__c + 50; // simulate change

        String jsonData = JSON.serialize(new List<Location__c>{ loc });

        Test.startTest();
        String result = SovJobLocationsController.saveInlineEdits(jsonData);
        Test.stopTest();

        System.assert(result.contains('Success'), 'Should successfully save inline edits');
    }

    // 🧪 Test getPicklistValuesForField
    @IsTest
    static void testGetPicklistValuesForField() {
        Test.startTest();
        List<String> values = SovJobLocationsController.getPicklistValuesForField('wfrecon__Scope_Entry__c', 'wfrecon__Scope_Entry_Status__c');
        Test.stopTest();

        System.assertNotEquals(null, values, 'Should return a list');
    }

    // 🧪 Test negative scenarios
    @IsTest
    static void testNegativeCases() {
        // 1️⃣ Empty JSON for saveInlineEdits
        Test.startTest();
        String result1 = SovJobLocationsController.saveInlineEdits('');
        String result2 = SovJobLocationsController.deleteLocationEntries(new List<Id>());
        Test.stopTest();

        System.assert(result1.contains('Error'), 'Should handle empty JSON gracefully');
        System.assert(result2.contains('Error'), 'Should handle empty deletion gracefully');
    }
}
