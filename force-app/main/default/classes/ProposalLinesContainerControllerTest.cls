/**
* Test Class Name: ProposalLinesContainerControllerTest
* @description: Test class for ProposalLinesContainerController
* Created Date: 1 Jan 2026
* Created By: Karan Singh
**/
@isTest
private class ProposalLinesContainerControllerTest {
    
    @testSetup
    static void setupTestData() {
        
        // Create Proposal
        wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();        
        proposal.wfrecon__OH__c = 10.0;
        proposal.wfrecon__Warranty__c = 5.0;
        proposal.wfrecon__Profit__c = 15.0;
        insert proposal;
        
        // Create Pricebook
        Pricebook2 pricebook = new Pricebook2();
        pricebook.Name = 'Test Pricebook';
        pricebook.IsActive = true;
        insert pricebook;
        
        // Create Product
        Product2 product = new Product2();
        product.Name = 'Test Product';
        product.IsActive = true;
        insert product;
        
        // Create Pricebook Entry
        Id pricebookId = Test.getStandardPricebookId();
        Pricebook2 standardPricebook = new Pricebook2(
            Id = pricebookId,
            IsActive = true
        );
        update standardPricebook;
      
        
        // Create Proposal Line
        wfrecon__Proposal_Line__c proposalLine = new wfrecon__Proposal_Line__c();
        proposalLine.wfrecon__Proposal__c = proposal.Id;
        proposalLine.wfrecon__Product__c = product.Id;
        proposalLine.wfrecon__Price_Book__c = pricebook.Id;
        proposalLine.Name = 'Test Proposal Line';
        proposalLine.wfrecon__Quantity__c = 2;
        proposalLine.wfrecon__OH_Per__c = 10.0;
        proposalLine.wfrecon__Warranty_Per__c = 5.0;
        proposalLine.wfrecon__Profit_Per__c = 15.0;
        proposalLine.wfrecon__Type__c = 'Base Contract';
        proposalLine.wfrecon__Sequence__c = 1;
        insert proposalLine;
        
        // Create Budget
        wfrecon__Budget__c budget = new wfrecon__Budget__c();
        budget.wfrecon__Proposal_Line__c = proposalLine.Id;
        insert budget;
        
        // Create Budget Line
        wfrecon__Budget_Line__c budgetLine = new wfrecon__Budget_Line__c();
        budgetLine.wfrecon__Budget__c = budget.Id;
        budgetLine.wfrecon__Cost_Type__c = 'Labor';
        budgetLine.wfrecon__No_Of_Crew_Members__c = 2;
        budgetLine.wfrecon__Hrs_day__c = 8;
        budgetLine.wfrecon__Burden_Rate_Hour__c = 50.0;
        budgetLine.wfrecon__of_Days__c = 5;
        insert budgetLine;
    }
    
    @isTest
    static void testGetProposalLinesWithBudgets_Success() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProposalLinesWithBudgets(proposal.Id);
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Should return success');
        System.assertNotEquals(null, result.get('data'), 'Data should not be null');
        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertNotEquals(null, data.get('proposalLines'), 'Proposal lines should not be null');
    }
    
    @isTest
    static void testGetProposalLinesWithBudgets_BlankProposalId() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProposalLinesWithBudgets('');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
        System.assertEquals('Proposal ID is required', result.get('message'), 'Should return error message');
    }
    
    @isTest
    static void testGetProposalLinesWithBudgets_NullProposalId() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProposalLinesWithBudgets(null);
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
    }
    
    @isTest
    static void testGetPricebooks_Success() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getPricebooks();
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Should return success');
        System.assertNotEquals(null, result.get('data'), 'Data should not be null');
        List<Pricebook2> pricebooks = (List<Pricebook2>) result.get('data');
        System.assert(pricebooks.size() > 0, 'Should return at least one pricebook');
    }
    
    @isTest
    static void testGetProductsByPricebook_Success() {
        Pricebook2 pricebook = [SELECT Id FROM Pricebook2 WHERE IsActive = true LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProductsByPricebook(pricebook.Id);
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Should return success');
        System.assertNotEquals(null, result.get('data'), 'Data should not be null');
    }
    
    @isTest
    static void testGetProductsByPricebook_BlankPricebookId() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProductsByPricebook('');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
        System.assertEquals('Pricebook ID is required', result.get('message'), 'Should return error message');
    }
    
    @isTest
    static void testSaveProposalLines_Success() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        Product2 product = [SELECT Id FROM Product2 LIMIT 1];
        Pricebook2 pricebook = [SELECT Id FROM Pricebook2 LIMIT 1];
        
        Map<String, Object> linesData = new Map<String, Object>();
        linesData.put('proposalId', proposal.Id);
        
        List<Map<String, Object>> proposalLines = new List<Map<String, Object>>();
        Map<String, Object> line1 = new Map<String, Object>();
        line1.put('productId', product.Id);
        line1.put('pricebookId', pricebook.Id);
        line1.put('proposalLineName', 'Test Line 1');
        line1.put('description', 'Test Description 1');
        line1.put('quantity', 1);
        line1.put('oh', 10);
        line1.put('warranty', 5);
        line1.put('profit', 15);
        line1.put('type', 'Base Contract');
        proposalLines.add(line1);
        
        Map<String, Object> line2 = new Map<String, Object>();
        line2.put('productId', product.Id);
        line2.put('pricebookId', pricebook.Id);
        line2.put('proposalLineName', 'Test Line 2');
        line2.put('description', 'Test Description 2');
        line2.put('quantity', 2);
        line2.put('oh', 10);
        line2.put('warranty', 5);
        line2.put('profit', 15);
        line2.put('type', 'Alternate');
        proposalLines.add(line2);
        
        linesData.put('proposalLines', proposalLines);
        
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.saveProposalLines(JSON.serialize(linesData));
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Should return success');
        
        // Verify proposal lines were created
        List<wfrecon__Proposal_Line__c> createdLines = [
            SELECT Id, Name, wfrecon__Type__c, wfrecon__Sequence__c 
            FROM wfrecon__Proposal_Line__c 
            WHERE wfrecon__Proposal__c = :proposal.Id 
            AND Name IN ('Test Line 1', 'Test Line 2')
        ];
        System.assertEquals(2, createdLines.size(), 'Should create 2 proposal lines');
        
        // Verify budgets were created
        List<wfrecon__Budget__c> budgets = [
            SELECT Id 
            FROM wfrecon__Budget__c 
            WHERE wfrecon__Proposal_Line__c IN :createdLines
        ];
        System.assertEquals(2, budgets.size(), 'Should create 2 budgets');
    }
    
    @isTest
    static void testSaveProposalLines_BlankData() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.saveProposalLines('');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
        System.assertEquals('No data provided to save', result.get('message'), 'Should return error message');
    }
    
    @isTest
    static void testDeleteProposalLine_Success() {
        wfrecon__Proposal_Line__c proposalLine = [SELECT Id FROM wfrecon__Proposal_Line__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.deleteProposalLine(proposalLine.Id);
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Should return success');
        
        // Verify proposal line was deleted
        List<wfrecon__Proposal_Line__c> deletedLines = [
            SELECT Id 
            FROM wfrecon__Proposal_Line__c 
            WHERE Id = :proposalLine.Id
        ];
        System.assertEquals(0, deletedLines.size(), 'Proposal line should be deleted');
    }
    
    @isTest
    static void testDeleteProposalLine_BlankId() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.deleteProposalLine('');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
        System.assertEquals('Proposal Line ID is required', result.get('message'), 'Should return error message');
    }
    
    @isTest
    static void testDeleteProposalLine_InvalidId() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.deleteProposalLine('a0000000000000AAA');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
        System.assertEquals('Proposal line not found', result.get('message'), 'Should return error message');
    }
    
    @isTest
    static void testGetProposalDefaults_Success() {
        wfrecon__Proposal__c proposal = [SELECT Id FROM wfrecon__Proposal__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProposalDefaults(proposal.Id);
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Should return success');
        System.assertNotEquals(null, result.get('data'), 'Data should not be null');
        Map<String, Object> defaults = (Map<String, Object>) result.get('data');
        System.assertNotEquals(null, defaults.get('oh'), 'OH should not be null');
        System.assertNotEquals(null, defaults.get('warranty'), 'Warranty should not be null');
        System.assertNotEquals(null, defaults.get('profit'), 'Profit should not be null');
    }
    
    @isTest
    static void testGetProposalDefaults_BlankProposalId() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.getProposalDefaults('');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
        System.assertEquals('Proposal ID is required', result.get('message'), 'Should return error message');
    }
    
    @isTest
    static void testDeleteBudgetLine_Success() {
        wfrecon__Budget_Line__c budgetLine = [SELECT Id FROM wfrecon__Budget_Line__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.deleteBudgetLine(budgetLine.Id);
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Should return success');
        
        // Verify budget line was deleted
        List<wfrecon__Budget_Line__c> deletedLines = [
            SELECT Id 
            FROM wfrecon__Budget_Line__c 
            WHERE Id = :budgetLine.Id
        ];
        System.assertEquals(0, deletedLines.size(), 'Budget line should be deleted');
    }
    
    @isTest
    static void testDeleteBudgetLine_BlankId() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.deleteBudgetLine('');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
        System.assertEquals('Budget Line ID is required', result.get('message'), 'Should return error message');
    }
    
    @isTest
    static void testSwapProposalLineType_Success() {
        wfrecon__Proposal_Line__c proposalLine = [SELECT Id, wfrecon__Type__c FROM wfrecon__Proposal_Line__c LIMIT 1];
        String originalType = proposalLine.wfrecon__Type__c;
        String newType = originalType == 'Base Contract' ? 'Alternate' : 'Base Contract';
        
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.swapProposalLineType(proposalLine.Id, newType);
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Should return success');
        
        // Verify type was updated
        wfrecon__Proposal_Line__c updatedLine = [
            SELECT Id, wfrecon__Type__c 
            FROM wfrecon__Proposal_Line__c 
            WHERE Id = :proposalLine.Id
        ];
        System.assertEquals(newType, updatedLine.wfrecon__Type__c, 'Type should be updated');
    }
    
    @isTest
    static void testSwapProposalLineType_BlankId() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.swapProposalLineType('', 'Base Contract');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
        System.assertEquals('Proposal Line ID and Type are required', result.get('message'), 'Should return error message');
    }
    
    @isTest
    static void testSwapProposalLineType_BlankType() {
        wfrecon__Proposal_Line__c proposalLine = [SELECT Id FROM wfrecon__Proposal_Line__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.swapProposalLineType(proposalLine.Id, '');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
        System.assertEquals('Proposal Line ID and Type are required', result.get('message'), 'Should return error message');
    }
    
    @isTest
    static void testSaveAllChanges_Success() {
        wfrecon__Proposal_Line__c proposalLine = [SELECT Id FROM wfrecon__Proposal_Line__c LIMIT 1];
        wfrecon__Budget__c budget = [SELECT Id FROM wfrecon__Budget__c LIMIT 1];
        
        Map<String, Object> changesData = new Map<String, Object>();
        
        // Update proposal line
        List<Map<String, Object>> proposalLines = new List<Map<String, Object>>();
        Map<String, Object> lineUpdate = new Map<String, Object>();
        lineUpdate.put('Id', proposalLine.Id);
        lineUpdate.put('wfrecon__Quantity__c', 5);
        lineUpdate.put('wfrecon__Description__c', 'Updated Description');
        lineUpdate.put('wfrecon__Profit_Per__c', 20);
        lineUpdate.put('wfrecon__Sales_Price__c', 500);
        proposalLines.add(lineUpdate);
        changesData.put('proposalLines', proposalLines);
        
        // Insert budget line
        List<Map<String, Object>> budgetLines = new List<Map<String, Object>>();
        Map<String, Object> budgetLineInsert = new Map<String, Object>();
        budgetLineInsert.put('action', 'insert');
        budgetLineInsert.put('costType', 'materials');
        budgetLineInsert.put('proposalLineId', proposalLine.Id);
        budgetLineInsert.put('budgetId', budget.Id);
        budgetLineInsert.put('materials', 'Test Material');
        budgetLineInsert.put('qty', 10);
        budgetLineInsert.put('materialCostEach', 25.0);
        budgetLines.add(budgetLineInsert);
        
        // Update budget line
        wfrecon__Budget_Line__c existingBudgetLine = [SELECT Id FROM wfrecon__Budget_Line__c LIMIT 1];
        Map<String, Object> budgetLineUpdate = new Map<String, Object>();
        budgetLineUpdate.put('action', 'update');
        budgetLineUpdate.put('Id', existingBudgetLine.Id);
        budgetLineUpdate.put('costType', 'labor');
        budgetLineUpdate.put('proposalLineId', proposalLine.Id);
        budgetLineUpdate.put('budgetId', budget.Id);
        budgetLineUpdate.put('noOfCrewMembers', 3);
        budgetLineUpdate.put('hrsDay', 10);
        budgetLineUpdate.put('burdenRateHour', 60.0);
        budgetLineUpdate.put('ofDays', 7);
        budgetLineUpdate.put('note', 'Updated Note');
        budgetLines.add(budgetLineUpdate);
        
        changesData.put('budgetLines', budgetLines);
        
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.saveAllChanges(JSON.serialize(changesData));
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Should return success');
        
        // Verify proposal line was updated
        wfrecon__Proposal_Line__c updatedLine = [
            SELECT Id, wfrecon__Quantity__c, wfrecon__Description__c 
            FROM wfrecon__Proposal_Line__c 
            WHERE Id = :proposalLine.Id
        ];
        System.assertEquals(5, updatedLine.wfrecon__Quantity__c, 'Quantity should be updated');
        System.assertEquals('Updated Description', updatedLine.wfrecon__Description__c, 'Description should be updated');
        
        // Verify budget line was inserted
        List<wfrecon__Budget_Line__c> insertedBudgetLines = [
            SELECT Id 
            FROM wfrecon__Budget_Line__c 
            WHERE wfrecon__Budget__c = :budget.Id 
            AND wfrecon__Cost_Type__c = 'Materials'
        ];
        System.assert(insertedBudgetLines.size() > 0, 'Budget line should be inserted');
    }
    
    @isTest
    static void testSaveAllChanges_BlankData() {
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.saveAllChanges('');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Should return failure');
        System.assertEquals('Changes data is required', result.get('message'), 'Should return error message');
    }
    
    @isTest
    static void testSaveAllChanges_AllCostTypes() {
        wfrecon__Proposal_Line__c proposalLine = [SELECT Id FROM wfrecon__Proposal_Line__c LIMIT 1];
        wfrecon__Budget__c budget = [SELECT Id FROM wfrecon__Budget__c LIMIT 1];
        
        Map<String, Object> changesData = new Map<String, Object>();
        List<Map<String, Object>> budgetLines = new List<Map<String, Object>>();
        
        // Test hotel cost type
        Map<String, Object> hotelLine = new Map<String, Object>();
        hotelLine.put('action', 'insert');
        hotelLine.put('costType', 'hotel');
        hotelLine.put('proposalLineId', proposalLine.Id);
        hotelLine.put('budgetId', budget.Id);
        hotelLine.put('ofNights', 3);
        hotelLine.put('numberOfRooms', 2);
        hotelLine.put('costsPerNight', 100.0);
        budgetLines.add(hotelLine);
        
        // Test mileage cost type
        Map<String, Object> mileageLine = new Map<String, Object>();
        mileageLine.put('action', 'insert');
        mileageLine.put('costType', 'mileage');
        mileageLine.put('proposalLineId', proposalLine.Id);
        mileageLine.put('budgetId', budget.Id);
        mileageLine.put('ofTrips', 5);
        mileageLine.put('ofTrucks', 2);
        mileageLine.put('mileage', 100);
        mileageLine.put('mileageRate', 0.50);
        budgetLines.add(mileageLine);
        
        // Test per diem cost type
        Map<String, Object> perDiemLine = new Map<String, Object>();
        perDiemLine.put('action', 'insert');
        perDiemLine.put('costType', 'perdiem');
        perDiemLine.put('proposalLineId', proposalLine.Id);
        perDiemLine.put('budgetId', budget.Id);
        perDiemLine.put('perDiemOfDays', 5);
        perDiemLine.put('perDiemRate', 50.0);
        perDiemLine.put('ofMen', 3);
        budgetLines.add(perDiemLine);
        
        changesData.put('budgetLines', budgetLines);
        
        Test.startTest();
        Map<String, Object> result = ProposalLinesContainerController.saveAllChanges(JSON.serialize(changesData));
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Should return success');
        
        // Verify all budget lines were created
        List<wfrecon__Budget_Line__c> createdLines = [
            SELECT Id, wfrecon__Cost_Type__c 
            FROM wfrecon__Budget_Line__c 
            WHERE wfrecon__Budget__c = :budget.Id
        ];
        System.assert(createdLines.size() >= 3, 'Should create budget lines for all cost types');
    }
}