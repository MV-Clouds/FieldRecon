public class UpdateTimeSheet implements Schedulable {
    public void execute(SchedulableContext sc) {
        UpdateTimesheetBatch bc = new UpdateTimesheetBatch();
        Database.ExecuteBatch(bc, 200);
    }
}