import { Tooltip } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { InscribeOrder, RawTxInfo, TokenBalance, TxType } from '@/shared/types';
import { Button, Card, Column, Content, Footer, Header, Icon, Input, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { Loading } from '@/ui/components/ActionComponent/Loading';
import { Empty } from '@/ui/components/Empty';
import { FeeRateBar } from '@/ui/components/FeeRateBar';
import InscriptionPreview from '@/ui/components/InscriptionPreview';
import WebsiteBar from '@/ui/components/WebsiteBar';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useNetworkType } from '@/ui/state/settings/hooks';
import {
  useCreateBitcoinTxCallback,
  useFetchUtxosCallback,
  usePushBitcoinTxCallback
} from '@/ui/state/transactions/hooks';
import { fontSizes } from '@/ui/theme/font';
import { spacing } from '@/ui/theme/spacing';
import { satoshisToAmount, useApproval, useLocationState, useWallet } from '@/ui/utils';

import { useNavigate } from '../../MainRoute';
import SignPsbt from './SignPsbt';

interface Props {
  params: {
    data: {
      ticker: string;
      amount: string;
    };
    session: {
      origin: string;
      icon: string;
      name: string;
    };
  };
}

enum Step {
  STEP1,
  STEP2,
  STEP3,
  STEP4
}

interface ContextData {
  step: Step;
  ticker: string;
  session?: any;
  tokenBalance?: TokenBalance;
  order?: InscribeOrder;
  rawTxInfo?: RawTxInfo;
  amount?: number;
  isApproval: boolean;
}

interface UpdateContextDataParams {
  step?: Step;
  ticket?: string;
  session?: any;
  tokenBalance?: TokenBalance;
  order?: InscribeOrder;
  rawTxInfo?: RawTxInfo;
  amount?: number;
}

export default function InscribeTransfer({ params: { data, session } }: Props) {
  const [contextData, setContextData] = useState<ContextData>({
    step: Step.STEP1,
    ticker: data.ticker,
    amount: parseInt(data.amount),
    session,
    isApproval: true
  });
  const updateContextData = useCallback(
    (params: UpdateContextDataParams) => {
      setContextData(Object.assign({}, contextData, params));
    },
    [contextData, setContextData]
  );

  if (contextData.step === Step.STEP1) {
    return <InscribeTransferStep contextData={contextData} updateContextData={updateContextData} />;
  } else if (contextData.step === Step.STEP2) {
    return <InscribeConfirmStep contextData={contextData} updateContextData={updateContextData} />;
  } else if (contextData.step === Step.STEP3) {
    return <InscribeSignStep contextData={contextData} updateContextData={updateContextData} />;
  } else {
    return <InscribeResultStep contextData={contextData} updateContextData={updateContextData} />;
  }
}

interface LocationState {
  ticker: string;
}

export function InscribeTransferScreen() {
  const { ticker } = useLocationState<LocationState>();

  const [contextData, setContextData] = useState<ContextData>({
    step: Step.STEP1,
    ticker: ticker,
    isApproval: false
  });
  const updateContextData = useCallback(
    (params: UpdateContextDataParams) => {
      setContextData(Object.assign({}, contextData, params));
    },
    [contextData, setContextData]
  );

  if (contextData.step === Step.STEP1) {
    return <InscribeTransferStep contextData={contextData} updateContextData={updateContextData} />;
  } else if (contextData.step === Step.STEP2) {
    return <InscribeConfirmStep contextData={contextData} updateContextData={updateContextData} />;
  } else if (contextData.step === Step.STEP3) {
    return <InscribeSignStep contextData={contextData} updateContextData={updateContextData} />;
  } else {
    return <InscribeResultStep contextData={contextData} updateContextData={updateContextData} />;
  }
}

interface StepProps {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}

function InscribeTransferStep({ contextData, updateContextData }: StepProps) {
  const networkType = useNetworkType();
  const [getApproval, resolveApproval, rejectApproval] = useApproval();

  const handleCancel = () => {
    rejectApproval('User rejected the request.');
  };

  const wallet = useWallet();
  const account = useCurrentAccount();
  const [feeRate, setFeeRate] = useState(5);
  const [inputAmount, setInputAmount] = useState('');

  const tools = useTools();
  const createBitcoinTx = useCreateBitcoinTxCallback();

  const fetchUtxos = useFetchUtxosCallback();

  const [inputError, setInputError] = useState('');

  const [disabled, setDisabled] = useState(true);

  const [inputDisabled, setInputDisabled] = useState(false);
  useEffect(() => {
    if (contextData.amount) {
      setInputAmount(contextData.amount.toString());
      setInputDisabled(true);
    }
  }, []);

  useEffect(() => {
    setInputError('');
    setDisabled(true);

    const amount = parseInt(inputAmount);
    if (!amount) {
      return;
    }

    if (!contextData.tokenBalance) {
      return;
    }

    if (amount <= 0) {
      return;
    }

    if (amount > parseInt(contextData.tokenBalance.availableBalanceSafe)) {
      setInputError('Insufficient Balance');
      return;
    }

    if (feeRate <= 0) {
      return;
    }

    setDisabled(false);
  }, [inputAmount, feeRate, contextData.tokenBalance]);

  useEffect(() => {
    fetchUtxos();
    wallet
      .getBRC20Summary(account.address, contextData.ticker)
      .then((v) => {
        updateContextData({ tokenBalance: v.tokenBalance });
      })
      .catch((e) => {
        tools.toastError(e.message);
      });
  }, []);

  const onClickInscribe = async () => {
    try {
      tools.showLoading(true);
      const amount = parseInt(inputAmount);
      const order = await wallet.inscribeBRC20Transfer(account.address, contextData.ticker, amount.toString(), feeRate);
      const rawTxInfo = await createBitcoinTx({ address: order.payAddress, domain: '' }, order.totalFee, feeRate);
      updateContextData({ order, amount, rawTxInfo, step: Step.STEP2 });
    } catch (e) {
      console.log(e);
      tools.toastError((e as Error).message);
    } finally {
      tools.showLoading(false);
    }
  };

  const { tokenBalance } = contextData;

  return (
    <Layout>
      {contextData.isApproval ? (
        <Header>
          <WebsiteBar session={contextData.session} />
        </Header>
      ) : (
        <Header
          onBack={() => {
            window.history.go(-1);
          }}
        />
      )}
      <Content>
        <Column full>
          <Column gap="lg" full>
            <Text text="Inscribe TRANSFER" preset="title-bold" textCenter my="lg" />

            <Column>
              <Row justifyBetween>
                <Text text="Available" color="textDim" />

                {tokenBalance ? (
                  <Column>
                    {tokenBalance.availableBalanceUnSafe != '0' ? (
                      <Row justifyCenter>
                        <Text
                          text={`${tokenBalance.availableBalanceSafe}  `}
                          textCenter
                          size="xs"
                          onClick={() => {
                            setInputAmount(tokenBalance.availableBalanceSafe);
                          }}
                        />
                        <Tooltip
                          title={`${tokenBalance.availableBalanceUnSafe} ${tokenBalance.ticker} is unconfirmed, please wait for confirmation `}
                          overlayStyle={{
                            fontSize: fontSizes.xs
                          }}>
                          <div>
                            <Row>
                              <Text
                                text={` + ${tokenBalance.availableBalanceUnSafe}`}
                                textCenter
                                color="textDim"
                                size="xs"
                              />
                              <Icon icon="circle-question" color="textDim" />
                            </Row>
                          </div>
                        </Tooltip>

                        <Text text={`${tokenBalance.ticker}  `} textCenter size="xs" />
                      </Row>
                    ) : (
                      <Text
                        text={`${tokenBalance.availableBalanceSafe} ${tokenBalance.ticker}`}
                        textCenter
                        size="xs"
                        onClick={() => {
                          setInputAmount(tokenBalance.availableBalanceSafe);
                        }}
                      />
                    )}
                  </Column>
                ) : (
                  <Text text={'loading...'} />
                )}
              </Row>

              <Input
                preset="amount"
                placeholder={'Amount'}
                value={inputAmount}
                autoFocus={true}
                onAmountInputChange={(amount) => {
                  setInputAmount(amount);
                }}
                disabled={inputDisabled}
              />
              {inputError && <Text text={inputError} color="error" />}
            </Column>

            <Column>
              <Text text="Fee Rate" color="textDim" />
              <FeeRateBar
                onChange={(val) => {
                  setFeeRate(val);
                }}
              />
            </Column>
          </Column>
        </Column>
      </Content>

      {contextData.isApproval ? (
        <Footer>
          <Row full>
            <Button text="Cancel" preset="default" onClick={handleCancel} full />
            <Button text="Next" preset="primary" onClick={onClickInscribe} full disabled={disabled} />
          </Row>
        </Footer>
      ) : (
        <Footer>
          <Row full>
            <Button text="Next" preset="primary" onClick={onClickInscribe} full disabled={disabled} />
          </Row>
        </Footer>
      )}
    </Layout>
  );
}

function InscribeConfirmStep({ contextData, updateContextData }: StepProps) {
  const tools = useTools();
  const pushBitcoinTx = usePushBitcoinTxCallback();

  const { order, tokenBalance, amount, rawTxInfo, session } = contextData;

  if (!order || !tokenBalance || !rawTxInfo) {
    return <Empty />;
  }

  const fee = rawTxInfo.fee || 0;
  const networkFee = useMemo(() => satoshisToAmount(fee), [fee]);
  const outputValue = useMemo(() => satoshisToAmount(order.outputValue), [order.outputValue]);
  const minerFee = useMemo(() => satoshisToAmount(order.minerFee + fee), [order.minerFee]);
  const originServiceFee = useMemo(() => satoshisToAmount(order.originServiceFee), [order.originServiceFee]);
  const serviceFee = useMemo(() => satoshisToAmount(order.serviceFee), [order.serviceFee]);
  const totalFee = useMemo(() => satoshisToAmount(order.totalFee + fee), [order.totalFee]);

  return (
    <Layout>
      {contextData.isApproval ? (
        <Header>
          <WebsiteBar session={contextData.session} />
        </Header>
      ) : (
        <Header
          onBack={() => {
            updateContextData({
              step: Step.STEP1
            });
          }}
        />
      )}
      <Content>
        <Column full>
          <Column gap="lg" full>
            <Text text="Inscribe TRANSFER" preset="title-bold" textCenter mt="lg" />

            <Column justifyCenter style={{ height: 250 }}>
              <Text text={`${amount} ${tokenBalance.ticker}`} preset="title-bold" size="xxl" color="gold" textCenter />

              <Column mt="xxl">
                <Text text="Preview" preset="sub-bold" />
                <Card preset="style2">
                  <Text
                    text={`{"p":"brc-20","op":"transfer","tick":"${tokenBalance.ticker}","amt":"${amount}"}`}
                    size="xs"
                  />
                </Card>
              </Column>
            </Column>

            <Column>
              <Row justifyBetween>
                <Text text="Payment Network Fee" color="textDim" />
                <Text text={`${networkFee} BTC`} />
              </Row>

              <Row justifyBetween>
                <Text text="Inscription Output Value" color="textDim" />
                <Text text={`${outputValue} BTC`} />
              </Row>

              <Row justifyBetween>
                <Text text="Inscription Network Fee" color="textDim" />
                <Text text={`${minerFee} BTC`} />
              </Row>

              <Row justifyBetween>
                <Text text="Service Fee" color="textDim" />
                {originServiceFee != serviceFee ? (
                  <Column>
                    <Text
                      text={`${originServiceFee} BTC`}
                      style={{ textDecorationLine: 'line-through' }}
                      color="textDim"
                    />
                    <Text text={`${serviceFee} BTC`} />
                  </Column>
                ) : (
                  <Text text={`${serviceFee} BTC`} />
                )}
              </Row>
              <Row justifyBetween>
                <Text text="Total" color="gold" />
                <Text text={`${totalFee} BTC`} color="gold" />
              </Row>
            </Column>
          </Column>
        </Column>
      </Content>
      {contextData.isApproval ? (
        <Footer>
          <Row full>
            <Button
              text="Back"
              preset="default"
              onClick={() => {
                updateContextData({
                  step: Step.STEP1
                });
              }}
              full
            />
            <Button
              text="Next"
              preset="primary"
              onClick={() => {
                updateContextData({
                  step: Step.STEP3
                });
                // onClickConfirm();
              }}
              full
            />
          </Row>
        </Footer>
      ) : (
        <Footer>
          <Row full>
            <Button
              text="Next"
              preset="primary"
              onClick={() => {
                updateContextData({
                  step: Step.STEP3
                });
                // onClickConfirm();
              }}
              full
            />
          </Row>
        </Footer>
      )}
    </Layout>
  );
}

function InscribeSignStep({
  contextData,
  updateContextData
}: {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}) {
  const pushBitcoinTx = usePushBitcoinTxCallback();
  const navigate = useNavigate();
  return (
    <SignPsbt
      header={
        contextData.isApproval ? (
          <Header>
            <WebsiteBar session={contextData.session} />
          </Header>
        ) : (
          <Header
            onBack={() => {
              updateContextData({
                step: Step.STEP2
              });
            }}
          />
        )
      }
      params={{
        data: {
          psbtHex: contextData.rawTxInfo!.psbtHex,
          type: TxType.SEND_BITCOIN,
          options: {
            autoFinalized: true
          }
        }
      }}
      handleConfirm={() => {
        pushBitcoinTx(contextData.rawTxInfo!.rawtx).then(({ success, txid, error }) => {
          if (success) {
            updateContextData({
              step: Step.STEP4
            });
          } else {
            navigate('TxFailScreen', { error });
          }
        });
      }}
    />
  );
}

function InscribeResultStep({
  contextData,
  updateContextData
}: {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}) {
  // contextData.tokenBalance = {
  //   availableBalance: '1900',
  //   availableBalanceSafe: '1900',
  //   availableBalanceUnSafe: '0',
  //   overallBalance: '2000',
  //   ticker: 'sats',
  //   transferableBalance: '100'
  // };
  // contextData.order = {
  //   orderId: 'fd9915ced9091f74765ad5c17e7e83425b875a87',
  //   payAddress: 'bc1p7fmwed05ux6hxn6pz63a8ce7nnzmdppfydny2e3gspdxxtc37duqex24ss',
  //   totalFee: 6485,
  //   minerFee: 3940,
  //   originServiceFee: 2499,
  //   serviceFee: 1999,
  //   outputValue: 546
  // };
  if (!contextData.order || !contextData.tokenBalance) {
    return <Empty />;
  }

  const { tokenBalance, order } = contextData;
  const tools = useTools();
  const wallet = useWallet();
  const currentAccount = useCurrentAccount();
  const [getApproval, resolveApproval, rejectApproval] = useApproval();
  const navigate = useNavigate();
  const [result, setResult] = useState<any>();
  const checkResult = async () => {
    const result = await wallet.getInscribeResult(order.orderId);
    if (!result) {
      setTimeout(() => {
        checkResult();
      }, 2000);
      return;
    }
    tools.showLoading(false);
    setResult(result);
  };

  useEffect(() => {
    checkResult();
  }, []);

  const onClickConfirm = () => {
    tools.showLoading(true);
    wallet
      .getBRC20Summary(currentAccount.address, tokenBalance.ticker)
      .then((v) => {
        if (contextData.isApproval) {
          resolveApproval({
            inscriptionId: result.inscriptionId,
            inscriptionNumber: result.inscriptionNumber,
            ticker: tokenBalance.ticker,
            amount: result.amount
          });
        } else {
          navigate('BRC20SendScreen', {
            tokenBalance: v.tokenBalance,
            selectedInscriptionIds: [result.inscriptionId],
            selectedAmount: parseInt(result.amount)
          });
        }
      })
      .finally(() => {
        tools.showLoading(false);
      });
  };

  if (!result) {
    return (
      <Layout>
        {contextData.isApproval ? (
          <Header>
            <WebsiteBar session={contextData.session} />
          </Header>
        ) : (
          <Header />
        )}
        <Content style={{ gap: spacing.small }}>
          <Column justifyCenter mt="xxl" gap="xl">
            <Row justifyCenter>
              <Icon icon="success" size={50} style={{ alignSelf: 'center' }} />
            </Row>

            <Text preset="title" text="Payment Sent" textCenter />
            <Text preset="sub" text="Your transaction has been successfully sent" color="textDim" textCenter />

            <Column justifyCenter itemsCenter>
              <Column mt="lg">
                <Loading text="Inscribing..." />
              </Column>
            </Column>
          </Column>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout>
      {contextData.isApproval ? (
        <Header>
          <WebsiteBar session={contextData.session} />
        </Header>
      ) : (
        <Header />
      )}
      <Content style={{ gap: spacing.small }}>
        <Column justifyCenter mt="xxl" gap="xl">
          <Text text="Inscribe Success" preset="title-bold" textCenter />
          <Column justifyCenter itemsCenter>
            <InscriptionPreview data={result.inscription} preset="medium" />

            <Column mt="lg">
              <Text
                text="The transferable and available balance of BRC20 will be refreshed in a few minutes."
                textCenter
              />
            </Column>
          </Column>
        </Column>
      </Content>
      {contextData.isApproval ? (
        <Footer>
          <Row full>
            <Button
              text="Done"
              preset="primary"
              onClick={() => {
                onClickConfirm();
              }}
              full
            />
          </Row>
        </Footer>
      ) : (
        <Footer>
          <Row full>
            <Button
              text="Done"
              preset="primary"
              onClick={() => {
                onClickConfirm();
              }}
              full
            />
          </Row>
        </Footer>
      )}
    </Layout>
  );
}
