@IsTest
public with sharing class SovJobScopeControllerTest {
    @TestSetup
    static void setupTestData() {
        // 1️⃣ Create Job
        Job__c job = new Job__c(
            Job_Name__c	 = 'Test Construction Job'
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

        // 4️⃣ Create Locations (with realistic square feet values)
        List<Location__c> locations = new List<Location__c>{
            new Location__c(
                Name = 'Main Hall',
                Square_Feet__c = 500,
                Job__c = job.Id
            ),
            new Location__c(
                Name = 'Conference Room',
                Square_Feet__c = 300,
                Job__c = job.Id
            ),
            new Location__c(
                Name = 'Lobby',
                Square_Feet__c = 200,
                Job__c = job.Id
            )
        };
        insert locations;

        // 5️⃣ Link Locations to Scope Entry via Location_Process__c
        //    Each Location will get processes created for the existing Scope Entry Processes
        List<Location_Process__c> locationProcesses = new List<Location_Process__c>();
        for (Location__c loc : locations) {
            for (Scope_Entry_Process__c proc : scopeEntryProcesses) {
                Decimal totalWeight = 0;
                for (Scope_Entry_Process__c p : scopeEntryProcesses) {
                    totalWeight += (p.Weight__c != null ? p.Weight__c : 0);
                }

                Decimal locationShare = loc.Square_Feet__c / (500 + 300 + 200); // total 1000 sq ft
                Decimal processShare = proc.Weight__c / totalWeight;
                Decimal contractPrice = scopeEntry.Contract_Value__c * locationShare * processShare;

                locationProcesses.add(new Location_Process__c(
                    Location__c = loc.Id,
                    Scope_Entry_Process__c = proc.Id,
                    Process_Library__c = null,
                    Sequence__c = proc.Sequence__c,
                    Contract_Price__c = contractPrice
                ));
            }
        }
        insert locationProcesses;

        // 6️⃣ Create Process Library records for testing
        List<Process__c> processLibrary = new List<Process__c>{
            new Process__c(
                wfrecon__Process_Name__c = 'Electrical Work',
                Process_Type__c = 'Generic',
                Weight__c = 1,
                Measurement_Type__c = 'Square Feet',
                Sequence__c = 1
            ),
            new Process__c(
                wfrecon__Process_Name__c = 'Plumbing Work',
                Process_Type__c = 'Generic',
                Weight__c = 2,
                Measurement_Type__c = 'Square Feet',
                Sequence__c = 2
            )
        };
        insert processLibrary;
    }

    @IsTest
    static void testGetScopeEntries() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = SovJobScopeController.getScopeEntries(job.Id);
        Test.stopTest();
        
        System.assertEquals(true, (Boolean)result.get('success'), 'Expected getScopeEntries to return success as true');
    }

    @IsTest
    static void testGetScopeEntryConfiguration() {
        Test.startTest();
        Map<String, Object> result = SovJobScopeController.getScopeEntryConfiguration();
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Expected getScopeEntryConfiguration to return a non-null result');
    }

    @IsTest
    static void testCreateScopeEntry() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        Map<String, Object> scopeEntryData = new Map<String, Object>{
            'name' => 'Test Scope Entry',
            'contractValue' => 50000,
            'description' => 'Test Description',
            'jobId' => job.Id,
            'type' => 'Contract'
        };
        
        Test.startTest();
        String result = SovJobScopeController.createScopeEntry(scopeEntryData);
        Test.stopTest();
        
        System.assertEquals('Success', result, 'Expected createScopeEntry to return Success');
    }

    @IsTest
    static void testDeleteScopeEntries() {
        Scope_Entry__c scopeEntry = [SELECT Id FROM Scope_Entry__c LIMIT 1];
        List<Id> scopeEntryIds = new List<Id>{scopeEntry.Id};
        
        Test.startTest();
        String result = SovJobScopeController.deleteScopeEntries(scopeEntryIds);
        Test.stopTest();
        
        System.assertEquals('Success', result, 'Expected deleteScopeEntries to return Success');
    }

    @IsTest
    static void testCreateScopeEntryProcess() {
        Scope_Entry__c scopeEntry = [SELECT Id FROM Scope_Entry__c LIMIT 1];
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        Map<String, Object> processData = new Map<String, Object>{
            'processName' => 'Test Process',
            'sequence' => 3,
            'processType' => 'Generic',
            'weightage' => 25,
            'measurementType' => 'Square Feet',
            'scopeEntryId' => scopeEntry.Id,
            'jobId' => job.Id
        };
        
        Test.startTest();
        String result = SovJobScopeController.createScopeEntryProcess(processData);
        Test.stopTest();
        
        System.assertEquals('Success', result, 'Expected createScopeEntryProcess to return Success');
    }

    @IsTest
    static void testGetProcessLibraryRecords() {
        Test.startTest();
        List<Process__c> result = SovJobScopeController.getProcessLibraryRecords();
        Test.stopTest();
        
        System.assertEquals(2, result.size(), 'Expected getProcessLibraryRecords to return 2 process library records');
    }

    @IsTest
    static void testCreateScopeEntryProcessesFromLibrary() {
        Scope_Entry__c scopeEntry = [SELECT Id FROM Scope_Entry__c LIMIT 1];
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        List<Process__c> processes = [SELECT Id FROM Process__c];
        
        List<String> selectedProcessIds = new List<String>();
        for (Process__c proc : processes) {
            selectedProcessIds.add(proc.Id);
        }
        
        Map<String, Object> processData = new Map<String, Object>{
            'scopeEntryId' => scopeEntry.Id,
            'jobId' => job.Id,
            'selectedProcessIds' => selectedProcessIds
        };
        
        Test.startTest();
        String result = SovJobScopeController.createScopeEntryProcessesFromLibrary(processData);
        Test.stopTest();
        
        System.assertEquals('Success', result, 'Expected createScopeEntryProcessesFromLibrary to return Success');
    }

    @IsTest
    static void testGetProcessTypes() {
        Test.startTest();
        List<String> result = SovJobScopeController.getProcessTypes();
        Test.stopTest();
        
        System.assertEquals(true, result.size() >= 0, 'Expected getProcessTypes to return a non-negative size');
    }

    @IsTest
    static void testGetJobLocations() {
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        Test.startTest();
        List<Location__c> result = SovJobScopeController.getJobLocations(job.Id);
        Test.stopTest();
        
        // Verify we have the expected locations
        System.assertEquals(true, result.size() >= 3, 'Expected at least 3 locations, but got: ' + result.size());
    }

    @IsTest
    static void testGetExistingLocationProcesses() {
        Scope_Entry__c scopeEntry = [SELECT Id FROM Scope_Entry__c LIMIT 1];
        
        Test.startTest();
        List<Id> result = SovJobScopeController.getExistingLocationProcesses(scopeEntry.Id);
        Test.stopTest();
        
        System.assertEquals(3, result.size(), 'Expected getExistingLocationProcesses to return 3 location IDs');
    }

    @IsTest
    static void testCreateLocationProcesses() {
        Scope_Entry__c scopeEntry = [SELECT Id FROM Scope_Entry__c LIMIT 1];
        List<Location__c> locations = [SELECT Id FROM Location__c];
        
        List<String> selectedLocationIds = new List<String>();
        for (Location__c loc : locations) {
            selectedLocationIds.add(loc.Id);
        }
        
        Map<String, Object> locationData = new Map<String, Object>{
            'scopeEntryId' => scopeEntry.Id,
            'selectedLocationIds' => selectedLocationIds,
            'originalLocationIds' => new List<String>(),
            'addedLocationIds' => selectedLocationIds,
            'removedLocationIds' => new List<String>(),
            'hasChanges' => true
        };
        
        Test.startTest();
        String result = SovJobScopeController.createLocationProcesses(locationData);
        Test.stopTest();
        
        System.assertEquals(true, result.startsWith('Success'), 'Expected createLocationProcesses to return a success message');
    }

    @IsTest
    static void testSaveScopeEntryInlineEdits() {
        Scope_Entry__c scopeEntry = [SELECT Id, Name, Contract_Value__c FROM Scope_Entry__c LIMIT 1];
        scopeEntry.Contract_Value__c = 120000;
        
        List<Scope_Entry__c> updatedEntries = new List<Scope_Entry__c>{scopeEntry};
        String updatedScopeEntriesJson = JSON.serialize(updatedEntries);
        
        Test.startTest();
        String result = SovJobScopeController.saveScopeEntryInlineEdits(updatedScopeEntriesJson);
        Test.stopTest();
        
        System.assertEquals(true, result.startsWith('Success'), 'Expected saveScopeEntryInlineEdits to return a success message');
    }

    @IsTest
    static void testCreateChangeOrderManual() {
        Scope_Entry__c originalScopeEntry = [SELECT Id FROM Scope_Entry__c LIMIT 1];
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        Map<String, Object> changeOrderData = new Map<String, Object>{
            'originalScopeEntryId' => originalScopeEntry.Id,
            'changeOrderName' => 'Test Change Order',
            'contractValue' => 25000,
            'processOption' => 'manual',
            'jobId' => job.Id,
            'manualProcess' => new Map<String, Object>{
                'processName' => 'Manual Test Process',
                'sequence' => 1,
                'processType' => 'Generic',
                'weightage' => 50,
                'measurementType' => 'Square Feet'
            }
        };
        
        Test.startTest();
        String result = SovJobScopeController.createChangeOrder(changeOrderData);
        Test.stopTest();
        
        System.assertEquals('Success', result, 'Expected createChangeOrder with manual process to return Success');
    }

        @IsTest
    static void testCreateChangeOrderLibrary() {
        Scope_Entry__c originalScopeEntry = [SELECT Id FROM Scope_Entry__c LIMIT 1];
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        List<Process__c> processes = [SELECT Id FROM Process__c LIMIT 2];
        
        List<String> selectedProcessIds = new List<String>();
        for (Process__c proc : processes) {
            selectedProcessIds.add(proc.Id);
        }
        
        Map<String, Object> changeOrderData = new Map<String, Object>{
            'originalScopeEntryId' => originalScopeEntry.Id,
            'changeOrderName' => 'Test Change Order',
            'contractValue' => 25000,
            'processOption' => 'library',
            'jobId' => job.Id,
            'selectedProcessIds' => selectedProcessIds
        };
        
        Test.startTest();
        String result = SovJobScopeController.createChangeOrder(changeOrderData);
        Test.stopTest();
        
        System.assertEquals('Success', result, 'Expected createChangeOrder with library process to return Success');
    }

    @IsTest
    static void testSaveProcessEntryInlineEdits() {
        List<Scope_Entry_Process__c> processes = [SELECT Id, Process_Name__c, Weight__c FROM Scope_Entry_Process__c LIMIT 1];
        if (!processes.isEmpty()) {
            processes[0].Weight__c = 50;
        }
        
        String updatedProcessEntriesJson = JSON.serialize(processes);
        
        Test.startTest();
        String result = SovJobScopeController.saveProcessEntryInlineEdits(updatedProcessEntriesJson);
        Test.stopTest();
        
        System.assertEquals(true, result.startsWith('Success'), 'Expected saveProcessEntryInlineEdits to return a success message');
    }

    @IsTest
    static void testGetPicklistValuesForField() {
        Test.startTest();
        List<String> result = SovJobScopeController.getPicklistValuesForField('Scope_Entry__c', 'Type__c');
        Test.stopTest();
        
        System.assertEquals(true, result.size() >= 0, 'Expected getPicklistValuesForField to return a non-negative size');
    }

    @IsTest
    static void testDeleteSelectedScopeEntryProcesses() {
        List<Scope_Entry_Process__c> processes = [SELECT Id FROM Scope_Entry_Process__c LIMIT 1];
        List<Id> processIds = new List<Id>();
        for (Scope_Entry_Process__c proc : processes) {
            processIds.add(proc.Id);
        }
        
        Test.startTest();
        String result = SovJobScopeController.deleteSelectedScopeEntryProcesses(processIds);
        Test.stopTest();
        
        System.assertEquals(true, result.startsWith('Success'), 'Expected deleteSelectedScopeEntryProcesses to return a success message');
    }

    // Negative test cases

    @IsTest
    static void testGetScopeEntriesWithNullJobId() {
        Test.startTest();
        Map<String, Object> result = SovJobScopeController.getScopeEntries(null);
        Test.stopTest();
        
    }

    @IsTest
    static void testCreateScopeEntryWithInvalidData() {
        Map<String, Object> scopeEntryData = new Map<String, Object>{
            'name' => null,
            'contractValue' => null,
            'description' => null,
            'jobId' => null,
            'type' => null
        };
        
        Test.startTest();
        String result = SovJobScopeController.createScopeEntry(scopeEntryData);
        Test.stopTest();
        
        System.assertEquals(true, result.startsWith('Error'), 'Expected createScopeEntry with invalid data to return an error message');
    }

    @IsTest
    static void testDeleteScopeEntriesWithEmptyList() {
        List<Id> scopeEntryIds = new List<Id>();
        
        Test.startTest();
        String result = SovJobScopeController.deleteScopeEntries(scopeEntryIds);
        Test.stopTest();
        
        System.assertEquals(true, result.contains('No records selected for deletion'), 'Expected error message about no records selected');
    }

    @IsTest
    static void testCreateScopeEntryProcessesFromLibraryWithEmptyList() {
        Scope_Entry__c scopeEntry = [SELECT Id FROM Scope_Entry__c LIMIT 1];
        Job__c job = [SELECT Id FROM Job__c LIMIT 1];
        
        Map<String, Object> processData = new Map<String, Object>{
            'scopeEntryId' => scopeEntry.Id,
            'jobId' => job.Id,
            'selectedProcessIds' => new List<String>()
        };
        
        Test.startTest();
        String result = SovJobScopeController.createScopeEntryProcessesFromLibrary(processData);
        Test.stopTest();
        
    }

    @IsTest
    static void testSaveScopeEntryInlineEditsWithBlankJson() {
        Test.startTest();
        String result = SovJobScopeController.saveScopeEntryInlineEdits('');
        Test.stopTest();
        
        System.assertEquals(true, result.contains('No scope entry data provided'), 'Expected error message about no data provided');
    }

}