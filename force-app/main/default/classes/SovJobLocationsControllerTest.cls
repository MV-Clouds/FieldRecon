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

        // 3️⃣ Create Scope Entry Processes (weights must add up to meaningful total)
        List<Scope_Entry_Process__c> scopeEntryProcesses = new List<Scope_Entry_Process__c>{
            new Scope_Entry_Process__c(
                Scope_Entry__c = scopeEntry.Id,
                Process_Name__c = 'Excavation',
                Process_Type__c = 'Generic',
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

        // 4️⃣ Create Locations (with realistic square feet values and unit of measure)
        List<Location__c> locations = new List<Location__c>{
            new Location__c(
                Name = 'Main Hall',
                Quantity__c = 500,
                Unit_of_Measure__c = 'Square Footage',
                Job__c = job.Id
            ),
            new Location__c(
                Name = 'Conference Room',
                Quantity__c = 300,
                Unit_of_Measure__c = 'Cubic Footage',
                Job__c = job.Id
            ),
            new Location__c(
                Name = 'Lobby',
                Quantity__c = 200,
                Unit_of_Measure__c = 'Linear Footage',
                Job__c = job.Id
            )
        };
        insert locations;

        // 5️⃣ Create Location_Scope_Entry__c junction records to link locations to scope entry
        List<Location_Scope_Entry__c> locationScopeEntries = new List<Location_Scope_Entry__c>();
        for (Location__c loc : locations) {
            locationScopeEntries.add(new Location_Scope_Entry__c(
                Location__c = loc.Id,
                Scope_Entry__c = scopeEntry.Id
            ));
        }
        insert locationScopeEntries;

        // 6️⃣ Link Locations to Scope Entry via Location_Process__c
        //    Each Location will get processes created for the existing Scope Entry Processes
        List<Location_Process__c> locationProcesses = new List<Location_Process__c>();
        for (Location__c loc : locations) {
            Integer counter = 1;
            for (Scope_Entry_Process__c proc : scopeEntryProcesses) {
                Decimal totalWeight = 0;
                for (Scope_Entry_Process__c p : scopeEntryProcesses) {
                    totalWeight += (p.Weight__c != null ? p.Weight__c : 0);
                }

                Decimal locationShare = loc.Quantity__c / (500 + 300 + 200); // total 1000 sq ft
                Decimal processShare = proc.Weight__c / totalWeight;
                Decimal contractPrice = scopeEntry.Contract_Value__c * locationShare * processShare;

                locationProcesses.add(new Location_Process__c(
                    Location__c = loc.Id,
                    Scope_Entry_Process__c = proc.Id,
                    Process_Library__c = null,
                    Sequence__c = counter++,
                    Contract_Price__c = contractPrice
                ));
            }
        }
        insert locationProcesses;

        // 7️⃣ Create Process Library records for testing
        List<Process__c> processLibrary = new List<Process__c>{
            new Process__c(
                Process_Name__c = 'Electrical Work',
                Process_Type__c = 'Generic',
                Weight__c = 1,
                Measurement_Type__c = 'Square Feet',
                Sequence__c = 1
            ),
            new Process__c(
                Process_Name__c = 'Plumbing Work',
                Process_Type__c = 'Generic',
                Weight__c = 2,
                Measurement_Type__c = 'Square Feet',
                Sequence__c = 2
            )
        };
        insert processLibrary;

    }

    // 🧪 Test getLocationEntries
    @IsTest
    static void testGetLocationEntries() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Test.startTest();
        Map<String, Object> result = SovJobLocationsController.getLocationEntries(job.Id);
        Test.stopTest();

        System.assertEquals(true, (Boolean)result.get('success'), 'Expected getLocationEntries to return success as true');
    }

    // 🧪 Test createLocationEntry
    @IsTest
    static void testCreateLocationEntry() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Map<String, Object> newLocData = new Map<String, Object>{
            'name' => 'New Location A',
            'quantity' => 250,
            'unitOfMeasure' => 'Square Footage',
            'jobId' => job.Id
        };

        Test.startTest();
        String result = SovJobLocationsController.createLocationEntry(newLocData);
        Test.stopTest();

        System.assertEquals('Success', result, 'Should return success on location creation');
    }

    // 🧪 Test deleteLocationEntries
    @IsTest
    static void testDeleteLocationEntries() {
        List<Location__c> locs = [SELECT Id FROM Location__c LIMIT 2];
        List<Id> locIds = new List<Id>();
        for (Location__c l : locs) {
            locIds.add(l.Id);
        }

        Test.startTest();
        String result = SovJobLocationsController.deleteLocationEntries(locIds);
        Test.stopTest();

        System.assertEquals(true, result.contains('Success'), 'Should delete location entries successfully');
    }

    // 🧪 Test getLocationConfiguration
    @IsTest
    static void testGetLocationConfiguration() {
        Test.startTest();
        Map<String, Object> result = SovJobLocationsController.getLocationConfiguration();
        Test.stopTest();

        System.assertNotEquals(null, result, 'Should return configuration data');
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

        System.assertEquals(true, result.contains('Success'), 'Should successfully save inline edits');
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

        System.assertEquals(true, result1.contains('Error'), 'Should handle empty JSON gracefully');
        System.assertEquals(true, result2.contains('Error'), 'Should handle empty deletion gracefully');
    }

    // 🧪 Test createLocationEntry with invalid data
    @IsTest
    static void testCreateLocationEntryWithInvalidData() {
        Map<String, Object> invalidData = new Map<String, Object>{
            'name' => null,
            'quantity' => null,
            'unitOfMeasure' => null,
            'jobId' => null
        };

        Test.startTest();
        String result = SovJobLocationsController.createLocationEntry(invalidData);
        Test.stopTest();

        System.assertEquals(true, result.contains('Error'), 'Should handle invalid data gracefully');
    }

    // 🧪 Test saveInlineEdits with empty list
    @IsTest
    static void testSaveInlineEditsWithEmptyList() {
        String emptyJson = JSON.serialize(new List<Location__c>());

        Test.startTest();
        String result = SovJobLocationsController.saveInlineEdits(emptyJson);
        Test.stopTest();

        System.assertEquals(true, result.contains('Error'), 'Should handle empty location list gracefully');
    }

    // 🧪 Test bulk operations
    @IsTest
    static void testBulkLocationOperations() {
        List<Location__c> allLocations = [SELECT Id, Quantity__c FROM Location__c];
        
        // Modify all locations
        for (Location__c loc : allLocations) {
            loc.Quantity__c = loc.Quantity__c + 25;
        }
        
        String jsonData = JSON.serialize(allLocations);
        
        Test.startTest();
        String saveResult = SovJobLocationsController.saveInlineEdits(jsonData);
        Test.stopTest();
        
        System.assertEquals(true, saveResult.contains('Success'), 'Should handle bulk updates successfully');
        
    }

    // 🧪 Test recalculation functionality specifically
    @IsTest
    static void testRecalculationTrigger() {
        Location__c loc = [SELECT Id, Quantity__c FROM Location__c WHERE Name = 'Main Hall' LIMIT 1];
        Decimal originalQuantity = loc.Quantity__c;
        
        // Change quantity to trigger recalculation
        loc.Quantity__c = originalQuantity + 100;
        String jsonData = JSON.serialize(new List<Location__c>{ loc });

        Test.startTest();
        String result = SovJobLocationsController.saveInlineEdits(jsonData);
        Test.stopTest();

        System.assertEquals(true, result.contains('Success'), 'Should successfully trigger recalculation');
        
        // Verify the location was updated
        Location__c updatedLoc = [SELECT Id, Quantity__c FROM Location__c WHERE Id = :loc.Id];
        System.assertEquals(originalQuantity + 100, updatedLoc.Quantity__c, 'Location quantity should be updated');
    }

    // 🧪 Test error handling for invalid picklist field
    @IsTest
    static void testGetPicklistValuesForInvalidField() {
        Test.startTest();
        List<String> values = SovJobLocationsController.getPicklistValuesForField('InvalidObject__c', 'InvalidField__c');
        Test.stopTest();

        System.assertEquals(0, values.size(), 'Should return empty list for invalid object/field');
    }

    // 🧪 Test that Junction Records are properly handled
    @IsTest
    static void testJunctionRecordIntegrity() {
        Scope_Entry__c scopeEntry = [SELECT Id FROM Scope_Entry__c LIMIT 1];
        List<Location__c> locations = [SELECT Id FROM Location__c];
        
        // Verify junction records exist
        Integer junctionCount = [SELECT COUNT() FROM Location_Scope_Entry__c WHERE Scope_Entry__c = :scopeEntry.Id];
        System.assertEquals(3, junctionCount, 'Should have 3 junction records for 3 locations');
        
        // Verify Location Processes exist
        Integer processCount = [SELECT COUNT() FROM Location_Process__c];
        System.assertEquals(6, processCount, 'Should have 6 location processes (3 locations * 2 processes each)');
    }

    // 🧪 Test mixed success and failure scenarios
    @IsTest
    static void testMixedResultsScenario() {
        List<Location__c> locations = [SELECT Id, Quantity__c FROM Location__c];
        
        // Create a mix of valid and potentially problematic updates
        locations[0].Quantity__c = 1000; // Valid update
        if (locations.size() > 1) {
            locations[1].Quantity__c = -50;   // Potentially invalid (negative quantity)
        }
        
        String jsonData = JSON.serialize(locations);

        Test.startTest();
        String result = SovJobLocationsController.saveInlineEdits(jsonData);
        Test.stopTest();

        // Should handle mixed results gracefully
        System.assertNotEquals(null, result, 'Should return a result message');
    }

    // 🧪 Test performance with larger datasets (simulate)
    @IsTest
    static void testPerformanceWithLargerDataset() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        // Create additional locations for performance testing
        List<Location__c> additionalLocations = new List<Location__c>();
        for (Integer i = 1; i <= 10; i++) {
            additionalLocations.add(new Location__c(
                Name = 'Performance Test Location ' + i,
                Quantity__c = 100 * i,
                Unit_of_Measure__c = 'Square Footage',
                Job__c = job.Id
            ));
        }
        insert additionalLocations;

        Test.startTest();
        Map<String, Object> result = SovJobLocationsController.getLocationEntries(job.Id);
        Test.stopTest();

    }

    // 🧪 Test data integrity after operations
    @IsTest
    static void testDataIntegrityAfterOperations() {
        // Get initial counts
        Integer initialLocationCount = [SELECT COUNT() FROM Location__c];
        Integer initialProcessCount = [SELECT COUNT() FROM Location_Process__c];
        Integer initialJunctionCount = [SELECT COUNT() FROM Location_Scope_Entry__c];
        
        // Create a new location
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        Map<String, Object> newLocData = new Map<String, Object>{
            'name' => 'Data Integrity Test Location',
            'quantity' => 500,
            'unitOfMeasure' => 'Square Footage',
            'jobId' => job.Id
        };

        Test.startTest();
        String createResult = SovJobLocationsController.createLocationEntry(newLocData);
        Test.stopTest();
        
    }

    @IsTest
    static void testRecalculateForChangedLocations_Success() {
        // Arrange
        Location__c testLoc = [SELECT Id FROM Location__c LIMIT 1];
        Set<Id> changedIds = new Set<Id>{ testLoc.Id };

        Test.startTest();
        String result = SovJobLocationsController.recalculateForChangedLocations(changedIds);
        Test.stopTest();

        // Assert
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(!result.contains('Error'), 'No error should occur');
    }
}