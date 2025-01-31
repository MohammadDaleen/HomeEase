import { Grow, Stack, Typography } from "@mui/material";
import prisma from "@/utils/PrismaClient";
import { Payment, Status, User } from "@prisma/client";
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Session } from "next-auth";
import PaymentOptions from "@/components/DateOptions";
import CreatePaymentForm from "@/components/payments/CreatePaymentForm";
import PaymentsList from "@/components/payments/paymentsList/PaymentsList";

interface props {
  payments: Payment[];
  session: Session;
  users: User[];
}

const groupByDay = (payments: Payment[], userId: string) => {
  const grouped = payments.reduce((acc, payment) => {
    const dateString = new Date(payment.createdAt).toLocaleDateString(undefined, { day: "numeric", month: 'long', year: 'numeric' });
    if (!acc[dateString]) {
      acc[dateString] = [];
    }
    acc[dateString].push({ userId, ...payment });
    return acc;
  }, {} as { [key: string]: { status: Status; userId: string }[] });
  return grouped;
}

const Payments = ({ payments, session, users }: props) => {
  const [byDay, setByDay] = useState<{ [key: string]: { status: Status; userId: string }[] } | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())


  useEffect(() => {
    setByDay(groupByDay(payments, session.user.id))
  }, [payments, session.user.id])

  return (
    <Grow in={true}>
      <Stack
        justifyContent='start'
        alignItems='center'
        height='100%'
        padding="2rem 0"
        margin="auto"
        width='95%'
        gap={4}
      >
        <PaymentOptions
          byDay={byDay}
          setSelected={setSelectedDate}
          selected={selectedDate}
          session={session}
          addButton={
            <CreatePaymentForm
              session={session}
              defaultDate={selectedDate}
              users={users}
              houseId={session.user.houseId || ''}
            />
          }
        />
        {
          byDay && (
            byDay[selectedDate.toLocaleString(undefined, { day: "numeric", month: "long", year: "numeric" })] &&
            byDay[selectedDate.toLocaleString(undefined, { day: "numeric", month: "long", year: "numeric" })].length > 0) ? (
            <PaymentsList
              payments={
                byDay[selectedDate.toLocaleString(undefined, { day: "numeric", month: "long", year: "numeric" })]
                  .map(payment => { let { userId, ...rest } = payment; return rest as Payment })
              }
              users={users}
              session={session} />
          ) : (
            <Stack height="100%" width="100%" justifyContent="center" alignItems="center" ><Typography variant="h6">No Payments on this day</Typography></Stack>
          )
        }
      </Stack >
    </Grow>
  );
};

export const getServerSideProps: GetServerSideProps = async ctx => {
  const session = await getSession(ctx);
  if (!session) {
    return {
      props: {},
      redirect: {
        destination: `/auth?redirectUrl=${encodeURIComponent(
          ctx.resolvedUrl
        )}`,
      },
    };
  }
  if (!session?.user?.houseId) {
    return {
      props: {},
      redirect: {
        destination: `/profile`,
      },
    };
  }

  const [payments, houseUsers] = await Promise.all([
    prisma.payment.findMany({
      where: { OR: [{ payerId: session?.user?.id }, { recipientId: session?.user?.id }] },
    }),
    prisma.user.findMany({
      where: {
        houseId: session?.user?.houseId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
  ]);
  const serializablePayments = payments.map(payment => {
    return {
      ...payment,
      createdAt: payment.createdAt.toString(),
      updatedAt: payment.updatedAt.toString(),
    };
  });

  return {
    props: {
      session: session,
      users: houseUsers,
      payments: serializablePayments,
    },
  };
};

export default Payments;
