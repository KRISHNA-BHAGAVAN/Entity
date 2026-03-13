import EventList from "../components/EventList";

const Dashboard = ({ events, isLoading, onSelectEvent, onRefresh }) => {
  return (
    <div className="w-full h-full p-0">
      <EventList
        events={events}
        isLoading={isLoading}
        onSelectEvent={onSelectEvent}
        onRefresh={onRefresh}
      />
    </div>
  );
};

export default Dashboard;