@isTest
public with sharing class BidsListControllerTest {
    
    @TestSetup
    static void setupTestData() {
        // Create test account
        Account testAccount = new Account(
            Name = 'Test Account'
        );
        insert testAccount;
        
        // Create test contact
        Contact testContact = new Contact(
            FirstName = 'Test',
            LastName = 'Contact',
            AccountId = testAccount.Id,
            Email = 'test@example.com',
            Phone = '1234567890'
        );
        insert testContact;
        
        // Create test bids
        List<wfrecon__Bid__c> testBids = new List<wfrecon__Bid__c>();
        for (Integer i = 0; i < 5; i++) {
            testBids.add(new wfrecon__Bid__c(
                Name = 'Test Bid ' + i,
                wfrecon__Status__c = 'Bidding',
                wfrecon__Bid_Due_Date__c = Date.today().addDays(i + 7),
                wfrecon__AccountId__c = testAccount.Id,
                wfrecon__Contact__c = testContact.Id,
                wfrecon__Description__c = 'Test Description ' + i,
                wfrecon__Amount__c = 1000 + (i * 100)
            ));
        }
        insert testBids;
        
        // Create test proposals for the first bid
        List<wfrecon__Proposal__c> testProposals = new List<wfrecon__Proposal__c>();
        for (Integer i = 0; i < 3; i++) {
            testProposals.add(new wfrecon__Proposal__c(
                wfrecon__Bid__c = testBids[0].Id,
                wfrecon__Type__c = 'Contract',
                wfrecon__Account__c = testAccount.Id,
                wfrecon__Contact__c = testContact.Id,
                wfrecon__Status__c = 'Ready For Review',
                wfrecon__OH__c = 10,
                wfrecon__Warranty__c = 5,
                wfrecon__Profit__c = 15,
                wfrecon__Expiration_Date__c = Date.today().addDays(30)
            ));
        }
        insert testProposals;
    }
    
    @isTest
    static void testGetAllBidsWithoutFilter() {
        Test.startTest();
        List<BidsListController.BidData> result = BidsListController.getAllBids(false);
        Test.stopTest();
    }
    
    @isTest
    static void testGetAllBidsWithFilter() {
        List<wfrecon__Bid__c> bids = [SELECT Id FROM wfrecon__Bid__c LIMIT 1];
        
        // Update to trigger recently viewed
        if (!bids.isEmpty()) {
            update bids[0];
        }
        
        Test.startTest();
        List<BidsListController.BidData> result = BidsListController.getAllBids(true);
        Test.stopTest();
    }
    
    @isTest
    static void testGetStatusPicklistValues() {
        Test.startTest();
        List<Map<String, String>> result = BidsListController.getStatusPicklistValues();
        Test.stopTest();
    }
    
    @isTest
    static void testGetProposalsForBid() {
        List<wfrecon__Bid__c> bids = [SELECT Id FROM wfrecon__Bid__c LIMIT 1];
        String bidId = !bids.isEmpty() ? bids[0].Id : null;
        
        Test.startTest();
        List<BidsListController.ProposalData> result = BidsListController.getProposalsForBid(bidId);
        Test.stopTest();
    }
    
    @isTest
    static void testGetProposalsForBidWithNullId() {
        Test.startTest();
        List<BidsListController.ProposalData> result = BidsListController.getProposalsForBid(null);
        Test.stopTest();
    }
    
    @isTest
    static void testGetProposalsForBidWithBlankId() {
        Test.startTest();
        List<BidsListController.ProposalData> result = BidsListController.getProposalsForBid('');
        Test.stopTest();
    }
    
    @isTest
    static void testCreateProposal() {
        List<wfrecon__Bid__c> bids = [SELECT Id FROM wfrecon__Bid__c LIMIT 1];
        List<Account> accounts = [SELECT Id FROM Account LIMIT 1];
        List<Contact> contacts = [SELECT Id FROM Contact LIMIT 1];
        
        String bidId = !bids.isEmpty() ? bids[0].Id : null;
        String accountId = !accounts.isEmpty() ? accounts[0].Id : null;
        String contactId = !contacts.isEmpty() ? contacts[0].Id : null;
        
        Test.startTest();
        String result = BidsListController.createProposal(
            bidId,
            'Standard',
            accountId,
            contactId,
            'Draft',
            10,
            5,
            15,
            Date.today().addDays(30)
        );
        Test.stopTest();
    }
    
    @isTest
    static void testCreateProposalWithNullBidId() {
        List<Account> accounts = [SELECT Id FROM Account LIMIT 1];
        List<Contact> contacts = [SELECT Id FROM Contact LIMIT 1];
        
        String accountId = !accounts.isEmpty() ? accounts[0].Id : null;
        String contactId = !contacts.isEmpty() ? contacts[0].Id : null;
        
        Test.startTest();
        try {
            String result = BidsListController.createProposal(
                null,
                'Standard',
                accountId,
                contactId,
                'Draft',
                10,
                5,
                15,
                Date.today().addDays(30)
            );
        } catch (Exception e) {
            // Exception handled
        }
        Test.stopTest();
    }
    
    @isTest
    static void testCreateBid() {
        List<Account> accounts = [SELECT Id FROM Account LIMIT 1];
        List<Contact> contacts = [SELECT Id FROM Contact LIMIT 1];
        
        String accountId = !accounts.isEmpty() ? accounts[0].Id : null;
        String contactId = !contacts.isEmpty() ? contacts[0].Id : null;
        
        Test.startTest();
        String result = BidsListController.createBid(
            'New Test Bid',
            'Open',
            Date.today().addDays(14),
            accountId,
            contactId,
            'New bid description'
        );
        Test.stopTest();
    }
    
    @isTest
    static void testCreateBidWithNullName() {
        List<Account> accounts = [SELECT Id FROM Account LIMIT 1];
        List<Contact> contacts = [SELECT Id FROM Contact LIMIT 1];
        
        String accountId = !accounts.isEmpty() ? accounts[0].Id : null;
        String contactId = !contacts.isEmpty() ? contacts[0].Id : null;
        
        Test.startTest();
        try {
            String result = BidsListController.createBid(
                null,
                'Open',
                Date.today().addDays(14),
                accountId,
                contactId,
                'New bid description'
            );
        } catch (Exception e) {
            // Exception handled
        }
        Test.stopTest();
    }
    
    @isTest
    static void testCreateBidWithNullStatus() {
        List<Account> accounts = [SELECT Id FROM Account LIMIT 1];
        List<Contact> contacts = [SELECT Id FROM Contact LIMIT 1];
        
        String accountId = !accounts.isEmpty() ? accounts[0].Id : null;
        String contactId = !contacts.isEmpty() ? contacts[0].Id : null;
        
        Test.startTest();
        try {
            String result = BidsListController.createBid(
                'New Test Bid',
                null,
                Date.today().addDays(14),
                accountId,
                contactId,
                'New bid description'
            );
        } catch (Exception e) {
            // Exception handled
        }
        Test.stopTest();
    }
    
    @isTest
    static void testCreateBidWithNullDueDate() {
        List<Account> accounts = [SELECT Id FROM Account LIMIT 1];
        List<Contact> contacts = [SELECT Id FROM Contact LIMIT 1];
        
        String accountId = !accounts.isEmpty() ? accounts[0].Id : null;
        String contactId = !contacts.isEmpty() ? contacts[0].Id : null;
        
        Test.startTest();
        try {
            String result = BidsListController.createBid(
                'New Test Bid',
                'Open',
                null,
                accountId,
                contactId,
                'New bid description'
            );
        } catch (Exception e) {
            // Exception handled
        }
        Test.stopTest();
    }
}