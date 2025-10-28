@IsTest
public with sharing class SovJobLocationProcessesControllerTest {
    
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

        // 4️⃣ Create Locations (with realistic square feet values)
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

        // 5️⃣ Link Locations to Scope Entry via Location_Process__c
        //    Each Location will get processes created for the existing Scope Entry Processes
        List<Location_Process__c> locationProcesses = new List<Location_Process__c>();
        for (Location__c loc : locations) {
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
                    Sequence__c = proc.Sequence__c,
                    Contract_Price__c = contractPrice
                ));
            }
        }
        insert locationProcesses;

    }

    /**
     * @description Test for getJobLocationProcesses()
     */
    @IsTest
    static void testGetJobLocationProcesses() {
        Job__c testJob = [SELECT Id FROM Job__c LIMIT 1];
        
        Test.startTest();
        List<Location_Process__c> result = SovJobLocationProcessesController.getJobLocationProcesses(testJob.Id);
        Test.stopTest();
        
        // Requery to ensure all necessary fields are available
        List<Location_Process__c> rechecked = [
            SELECT Id, Scope_Entry_Process__c, Location__c, Contract_Price__c
            FROM Location_Process__c
            WHERE Id IN :result
        ];
        
        System.assert(!rechecked.isEmpty(), 'Expected some location processes to be returned.');
        
        Location_Process__c sample = rechecked[0];
        System.assertNotEquals(null, sample.Scope_Entry_Process__c, 'Each location process should have a linked Scope Entry Process.');
        System.assertNotEquals(null, sample.Location__c, 'Each location process should have a linked Location.');
        System.assert(sample.Contract_Price__c > 0, 'Contract price should be greater than 0.');
    }

    /**
     * @description Test for batchUpdateProcessCompletion()
     */
    @IsTest
    static void testBatchUpdateProcessCompletion() {
        List<Location_Process__c> existingProcesses = [
            SELECT Id, Completed_Percentage__c 
            FROM Location_Process__c 
            LIMIT 2
        ];
        
        List<SovJobLocationProcessesController.ProcessUpdateWrapper> updates = new List<SovJobLocationProcessesController.ProcessUpdateWrapper>();
        for (Location_Process__c proc : existingProcesses) {
            SovJobLocationProcessesController.ProcessUpdateWrapper updateWrapper = 
                new SovJobLocationProcessesController.ProcessUpdateWrapper();
            updateWrapper.processId = proc.Id;
            updateWrapper.completionPercentage = 90;
            updates.add(updateWrapper);
        }

        Test.startTest();
        SovJobLocationProcessesController.BatchUpdateResult result = SovJobLocationProcessesController.batchUpdateProcessCompletion(updates);
        Test.stopTest();

        System.assertEquals(true, result.isSuccess, 'Expected batch update to be successful.');
        System.assertEquals(updates.size(), result.successCount, 'All processes should have been updated successfully.');
        System.assertEquals(0, result.errorCount, 'No errors should occur during batch update.');
        
        List<Location_Process__c> updatedProcesses = [
            SELECT Completed_Percentage__c 
            FROM Location_Process__c 
            WHERE Id IN :existingProcesses
        ];
        for (Location_Process__c p : updatedProcesses) {
            System.assertEquals(90, p.Completed_Percentage__c, 'Completion percentage should be updated to 90.');
        }
    }

    /**
     * @description Negative test for batchUpdateProcessCompletion() - Empty List
     */
    @IsTest
    static void testBatchUpdateProcessCompletionEmptyList() {
        Test.startTest();
        SovJobLocationProcessesController.BatchUpdateResult result =
            SovJobLocationProcessesController.batchUpdateProcessCompletion(new List<SovJobLocationProcessesController.ProcessUpdateWrapper>());
        Test.stopTest();

        System.assertEquals(false, result.isSuccess, 'Expected failure when empty list is passed.');
        System.assert(result.errorDetails != null && result.errorDetails.size() > 0, 'Error details should be populated.');
        System.assert(result.errorDetails[0].containsIgnoreCase('No processes provided'), 'Expected missing data message.');
    }

    @IsTest
    static void testBatchUpdateProcessCompletionValidationFailure() {
        // Create a temporary record and delete it to get a non-existing ID
        Location_Process__c tempProcess = new Location_Process__c(
            Location__c = [SELECT Id FROM Location__c LIMIT 1].Id,
            Scope_Entry_Process__c = [SELECT Id FROM Scope_Entry_Process__c LIMIT 1].Id,
            Sequence__c = 999
        );
        insert tempProcess;
        Id invalidId = tempProcess.Id;
        delete tempProcess;

        // Prepare update wrapper
        SovJobLocationProcessesController.ProcessUpdateWrapper updateWrapper = 
            new SovJobLocationProcessesController.ProcessUpdateWrapper();
        updateWrapper.processId = invalidId; // Non-existent ID
        updateWrapper.completionPercentage = 100; 
        List<SovJobLocationProcessesController.ProcessUpdateWrapper> updates = new List<SovJobLocationProcessesController.ProcessUpdateWrapper>{ updateWrapper };

        Test.startTest();
        SovJobLocationProcessesController.BatchUpdateResult result = SovJobLocationProcessesController.batchUpdateProcessCompletion(updates);
        Test.stopTest();

        System.assertEquals(false, result.isSuccess, 'Expected failure when invalid process ID is used.');
        System.assertEquals(1, result.errorCount, 'Expected 1 error for invalid process ID.');
        System.assertEquals(0, result.successCount, 'Expected 0 successful updates.');
    }

    /**
     * @description Test for getJobLocationProcesses() with null Job ID
     */
    @IsTest
    static void testGetJobLocationProcessesWithNullJobId() {
        Test.startTest();
        List<Location_Process__c> result = SovJobLocationProcessesController.getJobLocationProcesses(null);
        Test.stopTest();
        
        System.assertEquals(0, result.size(), 'Expected empty list when null Job ID is passed.');
    }

    /**
     * @description Test for getJobLocationProcesses() with invalid Job ID
     */
    @IsTest
    static void testGetJobLocationProcessesWithInvalidJobId() {
        // Create a temporary job and delete it to get a non-existing ID
        Job__c tempJob = new Job__c(Job_Name__c = 'Temp Job');
        insert tempJob;
        Id invalidId = tempJob.Id;
        delete tempJob;
        
        Test.startTest();
        List<Location_Process__c> result = SovJobLocationProcessesController.getJobLocationProcesses(invalidId);
        Test.stopTest();
        
        System.assertEquals(0, result.size(), 'Expected empty list when invalid Job ID is passed.');
    }

    /**
     * @description Test for batchUpdateProcessCompletion() with null list
     */
    @IsTest
    static void testBatchUpdateProcessCompletionWithNullList() {
        Test.startTest();
        SovJobLocationProcessesController.BatchUpdateResult result = 
            SovJobLocationProcessesController.batchUpdateProcessCompletion(null);
        Test.stopTest();

        System.assertEquals(false, result.isSuccess, 'Expected failure when null list is passed.');
        System.assert(result.errorDetails != null && result.errorDetails.size() > 0, 'Error details should be populated.');
        System.assert(result.errorDetails[0].containsIgnoreCase('No processes provided'), 'Expected missing data message.');
    }

    /**
     * @description Test for batchUpdateProcessCompletion() with mixed valid and invalid IDs
     */
    @IsTest
    static void testBatchUpdateProcessCompletionMixedValidInvalid() {
        List<Location_Process__c> existingProcesses = [
            SELECT Id, Completed_Percentage__c 
            FROM Location_Process__c 
            LIMIT 1
        ];
        
        // Create a temporary process and delete it to get a non-existing ID
        Location_Process__c tempProcess = new Location_Process__c(
            Location__c = [SELECT Id FROM Location__c LIMIT 1].Id,
            Scope_Entry_Process__c = [SELECT Id FROM Scope_Entry_Process__c LIMIT 1].Id,
            Sequence__c = 888
        );
        insert tempProcess;
        Id invalidId = tempProcess.Id;
        delete tempProcess;
        
        List<SovJobLocationProcessesController.ProcessUpdateWrapper> updates = new List<SovJobLocationProcessesController.ProcessUpdateWrapper>();
        
        // Add valid process update
        SovJobLocationProcessesController.ProcessUpdateWrapper validUpdate = 
            new SovJobLocationProcessesController.ProcessUpdateWrapper();
        validUpdate.processId = existingProcesses[0].Id;
        validUpdate.completionPercentage = 75;
        updates.add(validUpdate);
        
        // Add invalid process update
        SovJobLocationProcessesController.ProcessUpdateWrapper invalidUpdate = 
            new SovJobLocationProcessesController.ProcessUpdateWrapper();
        invalidUpdate.processId = invalidId;
        invalidUpdate.completionPercentage = 50;
        updates.add(invalidUpdate);

        Test.startTest();
        SovJobLocationProcessesController.BatchUpdateResult result = 
            SovJobLocationProcessesController.batchUpdateProcessCompletion(updates);
        Test.stopTest();

        System.assertEquals(false, result.isSuccess, 'Expected failure when mixed valid/invalid IDs are used.');
        System.assertEquals(1, result.successCount, 'Expected 1 successful update.');
        System.assertEquals(1, result.errorCount, 'Expected 1 error for invalid process ID.');
    }


}