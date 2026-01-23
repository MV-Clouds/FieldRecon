public with sharing class BidsListController {
    
    /*
    *********************************************************
    @description     : Method to get all bids or recently viewed bids
    @param           : Boolean filterByRecentlyViewed - Whether to filter by recently viewed bids
    @return          : List<BidData> - List of bids
    ********************************************************
    */
    @AuraEnabled(cacheable=true)
    public static List<BidData> getAllBids(Boolean filterByRecentlyViewed) {
        List<BidData> bidDataList = new List<BidData>();
        Set<Id> bidIdsToQuery = new Set<Id>();
        
        try {
            // If filtering by recently viewed, get the recently viewed bid IDs
            if (filterByRecentlyViewed) {
                bidIdsToQuery = getRecentlyViewedBidIds();
                if (bidIdsToQuery.isEmpty()) {
                    return bidDataList;
                }
            }
            
            // Build dynamic query
            String query = 'SELECT Id, Name, wfrecon__Description__c, wfrecon__Status__c, ' +
                          'wfrecon__AccountId__r.Name, wfrecon__AccountId__r.Id, wfrecon__Amount__c, wfrecon__Bid_Due_Date__c ' +
                          'FROM wfrecon__Bid__c ';
            
            // Add WHERE clause if filtering by recently viewed
            if (filterByRecentlyViewed && !bidIdsToQuery.isEmpty()) {
                query += 'WHERE Id IN :bidIdsToQuery ';
            }
            
            query += 'ORDER BY LastViewedDate DESC NULLS LAST, Name ASC';
            
            // Get bids based on filter
            List<wfrecon__Bid__c> bids = Database.query(query);
            
            if (bids.isEmpty()) {
                return bidDataList;
            }
            
            // Process bid data
            for (wfrecon__Bid__c bid : bids) {
                BidData bidData = new BidData();
                bidData.bidId = bid.Id;
                bidData.name = bid.Name;
                bidData.description = bid.wfrecon__Description__c;
                bidData.status = bid.wfrecon__Status__c;
                bidData.accountName = bid.wfrecon__AccountId__r?.Name;
                bidData.accountId = bid.wfrecon__AccountId__r?.Id;
                bidData.amount = bid.wfrecon__Amount__c != null ? bid.wfrecon__Amount__c : 0;
                bidData.dueDate = bid.wfrecon__Bid_Due_Date__c;
                
                bidDataList.add(bidData);
            }
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BidsListController', 'methodName' => 'getAllBids', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
        
        return bidDataList;
    }
    
    /*
    *********************************************************
    @description     : Helper method to get recently viewed bid IDs
    @return          : Set<Id> - Set of recently viewed bid IDs
    ********************************************************
    */
    private static Set<Id> getRecentlyViewedBidIds() {
        Set<Id> recentlyViewedBidIds = new Set<Id>();
        
        try {
            List<RecentlyViewed> recentItems = [
                SELECT Id 
                FROM RecentlyViewed 
                WHERE Type = 'wfrecon__Bid__c'
                ORDER BY LastViewedDate DESC 
                LIMIT 200
            ];
            
            for (RecentlyViewed item : recentItems) {
                recentlyViewedBidIds.add(item.Id);
            }
                    
        } catch (Exception e) {
            System.debug('Error getting recently viewed bids: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BidsListController', 'methodName' => 'getRecentlyViewedBidIds', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
        
        return recentlyViewedBidIds;
    }
    
    /*
    *********************************************************
    @description     : Method to get status picklist values
    @return          : List<String> - List of status values
    ********************************************************
    */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getStatusPicklistValues() {
        List<Map<String, String>> statusOptions = new List<Map<String, String>>();
        
        try {
            Schema.DescribeFieldResult fieldResult = wfrecon__Bid__c.wfrecon__Status__c.getDescribe();
            List<Schema.PicklistEntry> picklistValues = fieldResult.getPicklistValues();
            
            for (Schema.PicklistEntry entry : picklistValues) {
                if (entry.isActive()) {
                    Map<String, String> option = new Map<String, String>();
                    option.put('label', entry.getLabel());
                    option.put('value', entry.getValue());
                    statusOptions.add(option);
                }
            }
        } catch (Exception e) {
            System.debug('Error getting status picklist values: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BidsListController', 'methodName' => 'getStatusPicklistValues', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
        
        return statusOptions;
    }
    
    /*
    *********************************************************
    @description     : Method to get proposals related to a bid
    @param           : String bidId - Bid Id to fetch related proposals
    @return          : List<ProposalData> - List of proposals
    ********************************************************
    */
    @AuraEnabled
    public static List<ProposalData> getProposalsForBid(String bidId) {
        List<ProposalData> proposalDataList = new List<ProposalData>();
        
        try {
            if (String.isBlank(bidId)) {
                return proposalDataList;
            }
            
            List<wfrecon__Proposal__c> proposals = [
                SELECT Id, Name, wfrecon__Status__c, wfrecon__Contact__r.Name, wfrecon__Contact__r.Id,
                       wfrecon__Account__r.Name, wfrecon__Account__r.Id, wfrecon__Total_Price__c, 
                       wfrecon__Total_Sales_Price__c, wfrecon__Expiration_Date__c, wfrecon__Type__c
                FROM wfrecon__Proposal__c 
                WHERE wfrecon__Bid__c = :bidId
                ORDER BY CreatedDate DESC
            ];
            
            for (wfrecon__Proposal__c proposal : proposals) {
                ProposalData proposalData = new ProposalData();
                proposalData.proposalId = proposal.Id;
                proposalData.name = proposal.Name;
                proposalData.status = proposal.wfrecon__Status__c;
                proposalData.accountName = proposal.wfrecon__Account__r?.Name;
                proposalData.accountId = proposal.wfrecon__Account__r?.Id;
                proposalData.salesPersonName = proposal.wfrecon__Contact__r?.Name;
                proposalData.salesPersonId = proposal.wfrecon__Contact__r?.Id;
                proposalData.totalPrice = proposal.wfrecon__Total_Price__c != null ? proposal.wfrecon__Total_Price__c : 0;
                proposalData.totalSalesPrice = proposal.wfrecon__Total_Sales_Price__c != null ? proposal.wfrecon__Total_Sales_Price__c : 0;
                proposalData.expirationDate = proposal.wfrecon__Expiration_Date__c;
                proposalData.proposalType = proposal.wfrecon__Type__c;
                
                proposalDataList.add(proposalData);
            }
            
        } catch (Exception e) {
            System.debug('Error in getProposalsForBid: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BidsListController', 'methodName' => 'getProposalsForBid', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
        
        return proposalDataList;
    }
    
    /*
    *********************************************************
    @description     : Method to create a new proposal
    @param           : String bidId - Bid Id
    @param           : String proposalType - Type of proposal
    @param           : String accountId - Account Id
    @param           : String contactId - Contact Id
    @param           : String status - Status
    @param           : Decimal oh - OH percentage
    @param           : Decimal warranty - Warranty percentage
    @param           : Decimal profit - Profit percentage
    @param           : Date expirationDate - Expiration date
    @return          : String - Created Proposal Id
    ********************************************************
    */
    @AuraEnabled
    public static String createProposal(String bidId, String proposalType, String accountId, 
                                       String contactId, String status, Decimal oh, 
                                       Decimal warranty, Decimal profit, Date expirationDate) {
        try {
            wfrecon__Proposal__c proposal = new wfrecon__Proposal__c();
            proposal.wfrecon__Bid__c = bidId;
            proposal.wfrecon__Type__c = proposalType;
            proposal.wfrecon__Account__c = accountId;
            proposal.wfrecon__Contact__c = contactId;
            proposal.wfrecon__Status__c = status;
            proposal.wfrecon__OH__c = oh;
            proposal.wfrecon__Warranty__c = warranty;
            proposal.wfrecon__Profit__c = profit;
            proposal.wfrecon__Expiration_Date__c = expirationDate;
            
            insert proposal;
            
            return proposal.Id;
            
        } catch (Exception e) {
            System.debug('Error in createProposal: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BidsListController', 'methodName' => 'createProposal', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }
    
    /*
    *********************************************************
    @description     : Method to create a new bid
    @param           : String bidName - Name of the bid
    @param           : String status - Status
    @param           : Date dueDate - Bid Due Date
    @param           : String accountId - Account Id
    @param           : String contactId - Sales Person (Contact) Id
    @param           : String description - Description
    @return          : String - Created Bid Id
    ********************************************************
    */
    @AuraEnabled
    public static String createBid(String bidName, String status, Date dueDate, 
                                   String accountId, String contactId, String description) {
        try {
            wfrecon__Bid__c bid = new wfrecon__Bid__c();
            bid.Name = bidName;
            bid.wfrecon__Status__c = status;
            bid.wfrecon__Bid_Due_Date__c = dueDate;
            bid.wfrecon__AccountId__c = accountId;
            bid.wfrecon__Contact__c = contactId;
            bid.wfrecon__Description__c = description;
            
            insert bid;
            
            return bid.Id;
            
        } catch (Exception e) {
            System.debug('Error in createBid: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'BidsListController', 'methodName' => 'createBid', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    // Wrapper class for bid data
    public class BidData {
        @AuraEnabled public String bidId { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String description { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String accountName { get; set; }
        @AuraEnabled public String accountId { get; set; }
        @AuraEnabled public Decimal amount { get; set; }
        @AuraEnabled public Date dueDate { get; set; }
        
        public BidData() {
            this.amount = 0;
        }
    }

    /*
    *********************************************************
    @description     : Wrapper class for proposal data
    ********************************************************
    */
    public class ProposalData {
        @AuraEnabled public String proposalId { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String accountName { get; set; }
        @AuraEnabled public String accountId { get; set; }
        @AuraEnabled public String salesPersonName { get; set; }
        @AuraEnabled public String salesPersonId { get; set; }
        @AuraEnabled public Decimal totalPrice { get; set; }
        @AuraEnabled public Decimal totalSalesPrice { get; set; }
        @AuraEnabled public Date expirationDate { get; set; }
        @AuraEnabled public String proposalType { get; set; }
        
        public ProposalData() {
            this.totalPrice = 0;
            this.totalSalesPrice = 0;
        }
    }
}