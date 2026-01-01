/**
* Class Name: ProposalLinesContainerControllerTest
* @description: Test class for ProposalLinesContainerController
* Created Date: 1 Jan 2026
* Created By: AI Assistant
*--------------------------------------------------------------------------------
* Modification History:
* Date Modified - Developer Name - Description
* 
**/
@isTest
private class ProposalLinesContainerControllerTest {
    
    @TestSetup
    static void setupTestData() {
        // Create Pricebook
        Pricebook2 standardPricebook = new Pricebook2(
            Id = Test.getStandardPricebookId(),
            IsActive = true
        );
        update standardPricebook;

        Pricebook2 customPricebook = new Pricebook2(
            Name = 'Test Pricebook',
            IsActive = true
        );
        insert customPricebook;

        // Create Products
        List<Product2> products = new List<Product2>();
        for (Integer i = 1; i <= 3; i++) {
            products.add(new Product2(
                Name = 'Test Product ' + i,
                IsActive = true,
                ProductCode = 'PROD-' + i
            ));
        }
        insert products;

        // Create Standard Pricebook Entries
        List<PricebookEntry> standardEntries = new List<PricebookEntry>();
        for (Product2 prod : products) {
            standardEntries.add(new PricebookEntry(
                Pricebook2Id = standardPricebook.Id,
                Product2Id = prod.Id,
                UnitPrice = 100,
                IsActive = true
            ));
        }
        insert standardEntries;

        // Create Custom Pricebook Entries
        List<PricebookEntry> customEntries = new List<PricebookEntry>();
        for (Product2 prod : products) {
            customEntries.add(new PricebookEntry(
                Pricebook2Id = customPricebook.Id,
                Product2Id = prod.Id,
                UnitPrice = 150,
                IsActive = true
            ));
        }
        insert customEntries;

        // Create Proposal
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c(
            Name = 'Test Proposal'
        );
        insert proposal;

        // Create Proposal Lines (without Product/Pricebook)
        List<wfrecon__Proposal_Line__c> proposalLines = new List<wfrecon__Proposal_Line__c>();
        for (Integer i = 0; i < 2; i++) {
            proposalLines.add(new wfrecon__Proposal_Line__c(
                wfrecon__Proposal__c = proposal.Id,
                Name = 'Proposal Line ' + (i + 1),
                wfrecon__Description__c = 'Test Description ' + i
            ));
        }
        insert proposalLines;

        // Create Budgets
        List<wfrecon__Budget__c> budgets = new List<wfrecon__Budget__c>();
        for (wfrecon__Proposal_Line__c line : proposalLines) {
            budgets.add(new wfrecon__Budget__c(
                wfrecon__Proposal_Line__c = line.Id,
                Name = 'Budget for ' + line.Name
            ));
        }
        insert budgets;

        // Create Budget Lines (with Product/Pricebook)
        List<wfrecon__Budget_Line__c> budgetLines = new List<wfrecon__Budget_Line__c>();
        for (Integer i = 0; i < budgets.size(); i++) {
            budgetLines.add(new wfrecon__Budget_Line__c(
                wfrecon__Budget__c = budgets[i].Id,
                Name = 'Budget Line 1',
                wfrecon__Product__c = products[i].Id,
                wfrecon__Price_Book__c = customPricebook.Id,
                wfrecon__Description__c = 'Test Budget Line',
                wfrecon__Quantity__c = 5,
                wfrecon__Unit_Cost__c = 50
            ));
        }
        insert budgetLines;
    }

    @isTest
    static void testGetProposalLinesWithBudgets() {
        // Get test data
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];

        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProposalLinesWithBudgets(proposal.Id);
        Test.stopTest();

        // Verify results
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(true, result.get('success'), 'Should return success true');
        List<wfrecon__Proposal_Line__c> data = (List<wfrecon__Proposal_Line__c>) result.get('data');
        System.assertEquals(2, data.size(), 'Should return 2 proposal lines');
        System.assertEquals(1, data[0].wfrecon__Budgets__r.size(), 'Should have 1 budget');
        System.assertEquals(1, data[0].wfrecon__Budgets__r[0].wfrecon__Budget_Lines__r.size(), 'Should have 1 budget line');
        System.assertNotEquals(null, data[0].wfrecon__Budgets__r[0].wfrecon__Budget_Lines__r[0].wfrecon__Product__r.Name, 'Budget Line Product name should be populated');
        System.assertNotEquals(null, data[0].wfrecon__Budgets__r[0].wfrecon__Budget_Lines__r[0].wfrecon__Price_Book__r.Name, 'Budget Line Pricebook name should be populated');
    }

    @isTest
    static void testGetProposalLinesWithBudgetsEmpty() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProposalLinesWithBudgets('');
        Test.stopTest();

        // Verify results
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(false, result.get('success'), 'Should return success false');
        List<wfrecon__Proposal_Line__c> data = (List<wfrecon__Proposal_Line__c>) result.get('data');
        System.assertEquals(0, data.size(), 'Should return empty list');
    }

    @isTest
    static void testGetPricebooks() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getPricebooks();
        Test.stopTest();

        // Verify results
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(true, result.get('success'), 'Should return success true');
        List<Pricebook2> data = (List<Pricebook2>) result.get('data');
        System.assert(data.size() >= 1, 'Should return at least 1 pricebook');
    }

    @isTest
    static void testGetProductsByPricebook() {
        // Get test data
        Pricebook2 pricebook = [SELECT Id FROM Pricebook2 WHERE Name = 'Test Pricebook' LIMIT 1];

        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProductsByPricebook(pricebook.Id);
        Test.stopTest();

        // Verify results
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(true, result.get('success'), 'Should return success true');
        List<PricebookEntry> data = (List<PricebookEntry>) result.get('data');
        System.assertEquals(3, data.size(), 'Should return 3 pricebook entries');
        System.assertNotEquals(null, data[0].Product2.Name, 'Product name should be populated');
        System.assertEquals(150, data[0].UnitPrice, 'Unit price should be 150');
    }

    @isTest
    static void testGetProductsByPricebookEmpty() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProductsByPricebook('');
        Test.stopTest();

        // Verify results
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(false, result.get('success'), 'Should return success false');
        List<PricebookEntry> data = (List<PricebookEntry>) result.get('data');
        System.assertEquals(0, data.size(), 'Should return empty list');
    }

    @isTest
    static void testSaveProposalLines() {
        // Get test data
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        Pricebook2 pricebook = [SELECT Id FROM Pricebook2 WHERE Name = 'Test Pricebook' LIMIT 1];
        Product2 product = [SELECT Id FROM Product2 WHERE Name = 'Test Product 3' LIMIT 1];

        // Prepare JSON data - one proposal line with multiple budget lines
        Map<String, Object> proposalLineData = new Map<String, Object>{
            'proposalId' => proposal.Id,
            'proposalLineName' => 'New Proposal Line',
            'proposalLineDescription' => 'Test Proposal Line Description',
            'pricebookId' => pricebook.Id,
            'budgetLines' => new List<Map<String, Object>>{
                new Map<String, Object>{
                    'productId' => product.Id,
                    'quantity' => 5,
                    'unitCost' => 150,
                    'description' => 'Budget Line 1 Description'
                },
                new Map<String, Object>{
                    'productId' => product.Id,
                    'quantity' => 3,
                    'unitCost' => 100,
                    'description' => 'Budget Line 2 Description'
                }
            }
        };

        String jsonData = JSON.serialize(proposalLineData);

        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.saveProposalLines(jsonData);
        Test.stopTest();

        // Verify results
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(true, result.get('success'), 'Should return success true');

        List<wfrecon__Proposal_Line__c> proposalLines = [
            SELECT Id, Name FROM wfrecon__Proposal_Line__c
            WHERE wfrecon__Proposal__c = :proposal.Id
        ];
        System.assertEquals(3, proposalLines.size(), 'Should have 3 proposal lines total');

        List<wfrecon__Budget__c> budgets = [
            SELECT Id FROM wfrecon__Budget__c
            WHERE wfrecon__Proposal_Line__c IN :proposalLines
        ];
        System.assertEquals(3, budgets.size(), 'Should have 3 budgets');

        List<wfrecon__Budget_Line__c> budgetLines = [
            SELECT Id, wfrecon__Product__c, wfrecon__Price_Book__c, wfrecon__Quantity__c 
            FROM wfrecon__Budget_Line__c
            WHERE wfrecon__Budget__c IN :budgets
        ];
        System.assertEquals(4, budgetLines.size(), 'Should have 4 budget lines total (2 existing + 2 new)');
        
        // Verify new budget lines have product and pricebook
        Integer newBudgetLinesCount = 0;
        for (wfrecon__Budget_Line__c bl : budgetLines) {
            if (bl.wfrecon__Quantity__c == 5 || bl.wfrecon__Quantity__c == 3) {
                System.assertNotEquals(null, bl.wfrecon__Product__c, 'Budget line should have product');
                System.assertNotEquals(null, bl.wfrecon__Price_Book__c, 'Budget line should have pricebook');
                newBudgetLinesCount++;
            }
        }
        System.assertEquals(2, newBudgetLinesCount, 'Should have 2 new budget lines with products');
    }

    @isTest
    static void testSaveProposalLinesError() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.saveProposalLines('');
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(false, result.get('success'), 'Should return success false');
    }

    @isTest
    static void testDeleteProposalLine() {
        // Get test data
        wfrecon__Proposal_Line__c proposalLine = [SELECT Id FROM wfrecon__Proposal_Line__c LIMIT 1];

        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.deleteProposalLine(proposalLine.Id);
        Test.stopTest();

        // Verify results
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(true, result.get('success'), 'Should return success true');

        List<wfrecon__Proposal_Line__c> remainingLines = [
            SELECT Id FROM wfrecon__Proposal_Line__c WHERE Id = :proposalLine.Id
        ];
        System.assertEquals(0, remainingLines.size(), 'Proposal line should be deleted');

        List<wfrecon__Budget__c> remainingBudgets = [
            SELECT Id FROM wfrecon__Budget__c WHERE wfrecon__Proposal_Line__c = :proposalLine.Id
        ];
        System.assertEquals(0, remainingBudgets.size(), 'Budget should be deleted');
    }

    @isTest
    static void testDeleteProposalLineError() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.deleteProposalLine('');
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(false, result.get('success'), 'Should return success false');
    }
}
