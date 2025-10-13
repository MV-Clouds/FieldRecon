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
        List<wfrecon__Location_Process__c> result = SovJobLocationProcessesController.getJobLocationProcesses(testJob.Id);
        Test.stopTest();
        
        // Requery to ensure all necessary fields are available
        List<wfrecon__Location_Process__c> rechecked = [
            SELECT Id, wfrecon__Scope_Entry_Process__c, wfrecon__Location__c, wfrecon__Contract_Price__c
            FROM wfrecon__Location_Process__c
            WHERE Id IN :result
        ];
        
        System.assert(!rechecked.isEmpty(), 'Expected some location processes to be returned.');
        
        wfrecon__Location_Process__c sample = rechecked[0];
        System.assertNotEquals(null, sample.wfrecon__Scope_Entry_Process__c, 'Each location process should have a linked Scope Entry Process.');
        System.assertNotEquals(null, sample.wfrecon__Location__c, 'Each location process should have a linked Location.');
        System.assert(sample.wfrecon__Contract_Price__c > 0, 'Contract price should be greater than 0.');
    }

    /**
     * @description Test for batchUpdateProcessCompletion()
     */
    @IsTest
    static void testBatchUpdateProcessCompletion() {
        List<wfrecon__Location_Process__c> existingProcesses = [
            SELECT Id, wfrecon__Completed_Percentage__c 
            FROM wfrecon__Location_Process__c 
            LIMIT 2
        ];
        
        List<SovJobLocationProcessesController.ProcessUpdateWrapper> updates = new List<SovJobLocationProcessesController.ProcessUpdateWrapper>();
        for (wfrecon__Location_Process__c proc : existingProcesses) {
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
        
        List<wfrecon__Location_Process__c> updatedProcesses = [
            SELECT wfrecon__Completed_Percentage__c 
            FROM wfrecon__Location_Process__c 
            WHERE Id IN :existingProcesses
        ];
        for (wfrecon__Location_Process__c p : updatedProcesses) {
            System.assertEquals(90, p.wfrecon__Completed_Percentage__c, 'Completion percentage should be updated to 90.');
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

        // Prepare update wrapper
        SovJobLocationProcessesController.ProcessUpdateWrapper updateWrapper = 
            new SovJobLocationProcessesController.ProcessUpdateWrapper();
        updateWrapper.processId = '012000000000000AAA'; // Non-existent ID
        updateWrapper.completionPercentage = 100; 
        List<SovJobLocationProcessesController.ProcessUpdateWrapper> updates = new List<SovJobLocationProcessesController.ProcessUpdateWrapper>{ updateWrapper };

        Test.startTest();
        SovJobLocationProcessesController.BatchUpdateResult result = SovJobLocationProcessesController.batchUpdateProcessCompletion(updates);
        Test.stopTest();

    }


}
