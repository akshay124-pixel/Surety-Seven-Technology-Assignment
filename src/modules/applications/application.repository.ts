import { prisma } from '../../infrastructure/prisma/client';
import { Application, DecisionFactor, ApplicantSnapshot, Prisma } from '@prisma/client';
import { ApplicationStatus, BondType } from './application.types';
import { UnderwritingResult } from '../underwriting/underwriting.types';
import { ApplicantInfo } from '../applicant/applicant.types';

export interface CreateApplicationData {
  applicationId: string;
  applicantId: string;
  bondType: BondType;
  bondAmount: number;
  effectiveDate: Date;
  obligeeName: string;
}

export type ApplicationWithRelations = Application & {
  applicantSnapshot: ApplicantSnapshot | null;
  decisionFactors: DecisionFactor[];
};

export class ApplicationRepository {
  async create(data: CreateApplicationData): Promise<Application> {
    return prisma.application.create({
      data: {
        ...data,
        bondAmount: new Prisma.Decimal(data.bondAmount),
      },
    });
  }

  async findByApplicationId(applicationId: string): Promise<ApplicationWithRelations | null> {
    return prisma.application.findUnique({
      where: { applicationId },
      include: {
        applicantSnapshot: true,
        decisionFactors: true,
      },
    });
  }

  async updateStatus(
    applicationId: string,
    status: ApplicationStatus,
    failureCode?: string,
    failureMessage?: string
  ): Promise<Application> {
    return prisma.application.update({
      where: { applicationId },
      data: {
        status,
        ...(failureCode && { failureCode }),
        ...(failureMessage && { failureMessage }),
        updatedAt: new Date(),
      },
    });
  }

  async saveApplicantSnapshot(
    applicationId: string,
    applicantInfo: ApplicantInfo
  ): Promise<ApplicantSnapshot> {
    return prisma.applicantSnapshot.create({
      data: {
        applicationId,
        applicantId: applicantInfo.applicantId,
        annualRevenue: new Prisma.Decimal(applicantInfo.annualRevenue),
        yearsInBusiness: applicantInfo.yearsInBusiness,
        creditScore: applicantInfo.creditScore,
        existingExposure: new Prisma.Decimal(applicantInfo.existingExposure),
      },
    });
  }

  async saveUnderwritingResult(applicationId: string, result: UnderwritingResult): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { applicationId },
        data: {
          status:
            result.decision === 'APPROVE'
              ? ApplicationStatus.APPROVED
              : result.decision === 'REFER'
                ? ApplicationStatus.REFERRED
                : ApplicationStatus.DECLINED,
          score: result.score,
          decision: result.decision,
          updatedAt: new Date(),
        },
      });

      await tx.decisionFactor.createMany({
        data: result.factors.map((factor) => ({
          applicationId,
          factor: factor.factor,
          inputValue: String(factor.value),
          rule: factor.rule,
          points: factor.points,
          explanation: factor.explanation,
        })),
      });
    });
  }

  async updateStatusInTransaction(
    tx: Prisma.TransactionClient,
    applicationId: string,
    status: ApplicationStatus
  ): Promise<Application> {
    return tx.application.update({
      where: { applicationId },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
  }
}
