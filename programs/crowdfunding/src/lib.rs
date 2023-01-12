use anchor_lang::prelude::*;

declare_id!("3AZjYzmhGpnj5qK9Ddu9aaEbJXUs2UQtzX9XzKcUoELp");

#[program]
pub mod crowdfunding {

    use super::*;

    pub fn create(ctx: Context<Create>, name: String, description: String) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let bump = *ctx.bumps.get("campaign").ok_or(CrowdfundError::CannotGetBump)?;

        campaign.name = name;
        campaign.description = description;
        campaign.amount_donated = 0;
        campaign.admin = *ctx.accounts.user.key;
        campaign.bump = bump;
        Ok(())
    }

    // _name variable passed in for seed in campaign context, otherwise not useds
    pub fn withdraw(ctx: Context<Withdraw>, _name: String, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let user = &mut ctx.accounts.user;
        require!(
            campaign.admin == *user.key,
            CrowdfundError::IncorrectProgramId
        );
        let rent_balance = Rent::get()?.minimum_balance(campaign.to_account_info().data_len());
        require!(
            **campaign.to_account_info().lamports.borrow() - rent_balance > amount,
            CrowdfundError::InsufficientFunds
        );
        **campaign.to_account_info().try_borrow_mut_lamports()? -= amount;
        **user.to_account_info().try_borrow_mut_lamports()? += amount;
        Ok(())
    }

    // _name variable passed in for seed in campaign context, otherwise not used
    pub fn donate(ctx: Context<Donate>, _name: String, amount: u64) -> Result<()> {
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(), 
            &ctx.accounts.campaign.key(), 
            amount
        );
        anchor_lang::solana_program::program::invoke(
            &ix, 
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.campaign.to_account_info(),
            ]
        )?;
        (&mut ctx.accounts.campaign).amount_donated += amount;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct Create<'info> {
    // The seeds value is required because account needs to be a "program-derived" account (handled differently in tests)
    #[account(
        init, 
        payer=user, 
        space=9000, 
        seeds=[b"campaign", name.as_bytes().as_ref()],
        bump
    )]
    campaign: Account<'info, Campaign>,
    #[account(mut)]
    user: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds=[b"campaign", name.as_bytes().as_ref()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct Donate<'info> {
    #[account(
        mut,
        seeds=[b"campaign", name.as_bytes().as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[account]
pub struct Campaign {
    pub admin: Pubkey,
    pub name: String,
    pub description: String,
    pub amount_donated: u64,
    pub bump: u8,
}

#[error_code]
pub enum CrowdfundError {
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("User is not the campaign admin")]
    IncorrectProgramId,
    #[msg("Cannot get the bump.")]
    CannotGetBump
}
